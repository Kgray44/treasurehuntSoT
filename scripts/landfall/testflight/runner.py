#!/usr/bin/env python3
"""Isolated device archive / TestFlight transport. Credentials never enter artifacts."""

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

TEAM = "X2JZ9N65V2"
BUNDLE = "com.voyagewright.landfall"
SECRET_NAMES = (
    "NCL01_DISTRIBUTION_P12_BASE64", "NCL01_DISTRIBUTION_P12_PASSWORD",
    "NCL01_APPSTORE_PROFILE_BASE64", "NCL01_ASC_PRIVATE_KEY_P8",
)


class Failure(Exception):
    pass


def require(condition, label):
    if not condition:
        raise Failure(label)


def validate_origin(value):
    url = urllib.parse.urlsplit(value)
    require(url.scheme == "https" and url.hostname and not url.username and not url.password
            and url.path in ("", "/") and not url.query and not url.fragment,
            "HTTPS_ORIGIN_REQUIRED")
    # Origin is passed as a build-setting value, never a shell command.
    require(re.fullmatch(r"[A-Za-z0-9.:-]+", url.netloc), "ORIGIN_HOST_INVALID")
    return f"https://{url.netloc}", url.hostname


def signature_raw(der):
    """OpenSSL ECDSA ASN.1 integers -> JWT's fixed-width ES256 R || S."""
    def item(position, tag):
        require(der[position] == tag, "JWT_SIGNATURE_INVALID")
        length, position = der[position + 1], position + 2
        if length & 128:
            count = length & 127
            length = int.from_bytes(der[position:position + count], "big")
            position += count
        return der[position:position + length], position + length
    sequence, end = item(0, 0x30)
    require(end == len(der), "JWT_SIGNATURE_INVALID")
    original = der
    der = sequence
    left, position = item(0, 0x02)
    right, end = item(position, 0x02)
    require(end == len(sequence), "JWT_SIGNATURE_INVALID")
    der = original
    return int.from_bytes(left, "big").to_bytes(32, "big") + int.from_bytes(right, "big").to_bytes(32, "big")


def validate_profile(profile, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    expiry = profile["ExpirationDate"].replace(tzinfo=dt.timezone.utc)
    entitlements = profile.get("Entitlements", {})
    require(profile.get("TeamIdentifier") == [TEAM], "PROFILE_TEAM_MISMATCH")
    require(entitlements.get("application-identifier") == f"{TEAM}.{BUNDLE}", "PROFILE_APP_MISMATCH")
    require(entitlements.get("com.apple.developer.team-identifier") == TEAM, "PROFILE_ENTITLEMENT_TEAM_MISMATCH")
    require(entitlements.get("get-task-allow") is False, "DISTRIBUTION_PROFILE_REQUIRED")
    require(not profile.get("ProvisionedDevices") and not profile.get("ProvisionsAllDevices"), "APPSTORE_PROFILE_REQUIRED")
    require("TAG" in entitlements.get("com.apple.developer.nfc.readersession.formats", []), "PROFILE_NFC_REQUIRED")
    require(expiry > now + dt.timedelta(hours=1), "PROFILE_EXPIRED_OR_EXPIRING")
    require(re.fullmatch(r"[A-Fa-f0-9-]{36}", profile.get("UUID", "")), "PROFILE_UUID_INVALID")
    certificates = profile.get("DeveloperCertificates", [])
    require(len(certificates) == 1, "PROFILE_SINGLE_CERTIFICATE_REQUIRED")
    return hashlib.sha1(certificates[0]).hexdigest().upper()


def signing_overlay(root, identity, profile_uuid):
    """Override only the app's Release signing; retain the checked-in project spec."""
    return {
        "include": [{"path": str(root / "native/ios/project.yml"), "relativePaths": True}],
        "targets": {"LandfallCompanion": {"settings": {"configs": {"Release": {
            "CODE_SIGNING_ALLOWED": "YES", "CODE_SIGN_STYLE": "Manual", "DEVELOPMENT_TEAM": TEAM,
            "CODE_SIGN_IDENTITY": identity, "PROVISIONING_PROFILE_SPECIFIER": profile_uuid,
        }}}}},
    }


def altool_command(action, ipa, key_id, issuer, api_key=None):
    """Xcode 26 altool takes the archive as the action's positional value."""
    require(action in ("validate", "upload"), "ALTOOL_ACTION_INVALID")
    flag = "--validate-app" if action == "validate" else "--upload-package"
    command = ["xcrun", "altool", flag, str(ipa), "--api-key", key_id,
               "--api-issuer", issuer, "--output-format", "json"]
    if api_key:
        command.extend(["--p8-file-path", str(api_key)])
    return command


def altool_diagnostics(output, secret_values=()):
    """Keep bounded error fields, never altool's raw response or authentication."""
    def scrub(value):
        for secret in secret_values:
            if secret:
                value = value.replace(secret, "[REDACTED]")
                for line in secret.splitlines():
                    if line.strip():
                        value = value.replace(line.strip(), "[REDACTED]")
        value = re.sub(r"-----BEGIN [^-]+-----.*?-----END [^-]+-----", "[REDACTED_KEY]", value, flags=re.S)
        value = re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[REDACTED_TOKEN]", value)
        value = re.sub(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+", "[REDACTED_EMAIL]", value)
        return value[:800]

    # xcrun may prefix the JSON with its tool-path banner. Parse JSON only;
    # unstructured output is deliberately not copied into public artifacts.
    decoder = json.JSONDecoder()
    parsed = None
    for match in re.finditer(r"\{", output[:2_000_000]):
        try:
            value, _ = decoder.raw_decode(output, match.start())
            if isinstance(value, dict):
                parsed = value
                break
        except ValueError:
            continue
    messages = []
    if parsed is not None:
        for key in ("product-errors", "errors", "messages"):
            entries = parsed.get(key, [])
            if not isinstance(entries, list):
                continue
            for entry in entries[:8]:
                if not isinstance(entry, dict):
                    continue
                safe = {name: scrub(str(entry[name])) for name in ("code", "title", "message", "detail", "description")
                        if isinstance(entry.get(name), (str, int, float))}
                if safe:
                    messages.append(safe)
    return {"jsonResponseParsed": parsed is not None, "messages": messages[:8]}


class Runner:
    def __init__(self, args):
        self.args = args
        self.root = Path.cwd()
        self.public = self.root / "artifacts/ncl01-testflight/public"
        self.public.mkdir(parents=True, exist_ok=True)
        self.ownership = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())) / "ncl01-testflight-ownership.json"
        require(not self.ownership.exists(), "PREVIOUS_OWNERSHIP_REQUIRES_CLEANUP")
        self.temp = Path(tempfile.mkdtemp(prefix="ncl01-testflight-", dir=os.environ.get("RUNNER_TEMP")))
        self.temp.chmod(0o700)
        self.keychain = None
        self.installed_profiles = []
        self.previous_keychains = []
        self.stage = "PREFLIGHT"
        self.receipt = {
            "schemaVersion": 1, "candidateSha": args.candidate, "mode": args.mode,
            "teamId": TEAM, "bundleId": BUNDLE, "origin": args.origin,
            "version": args.version, "build": args.build,
            "uploadAccepted": False, "appleProcessing": "NOT_STARTED",
            "physicalInstallationProven": False, "physicalARProven": False,
        }
        self.save_ownership()

    def save_ownership(self):
        self.ownership.write_text(json.dumps({"temp": str(self.temp), "keychain": str(self.keychain) if self.keychain else None,
                                             "profiles": [str(value) for value in self.installed_profiles],
                                             "previousKeychains": self.previous_keychains}), encoding="utf-8")
        self.ownership.chmod(0o600)

    def run(self, command, *, data=None, public_log=False, env=None, altool_result=False):
        result = subprocess.run(command, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        if altool_result:
            diagnostic = altool_diagnostics((result.stdout + result.stderr).decode("utf-8", errors="replace"),
                                           [os.environ.get(name, "") for name in SECRET_NAMES])
            diagnostic["exitCode"] = result.returncode
            (self.public / f"{self.stage.lower()}.json").write_text(json.dumps(diagnostic, indent=2) + "\n", encoding="utf-8")
        if public_log:
            output = (result.stdout + result.stderr).decode("utf-8", errors="replace")
            for name in SECRET_NAMES:
                value = os.environ.get(name, "")
                if value:
                    output = output.replace(value, "[REDACTED]")
            output = re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[REDACTED_TOKEN]", output)
            (self.public / f"{self.stage.lower()}.log").write_text(output, encoding="utf-8")
        if result.returncode:
            # Record only the executable and exit status, never command arguments
            # (security import arguments contain the PKCS#12 password).
            self.receipt["failedTool"] = Path(command[0]).name
            self.receipt["failedExitCode"] = result.returncode
        require(result.returncode == 0, f"COMMAND_FAILED_{self.stage}")
        return result.stdout

    def private_file(self, name, data):
        destination = self.temp / name
        destination.write_bytes(data)
        destination.chmod(0o600)
        return destination

    def configure_signing(self):
        self.stage = "SIGNING_PREFLIGHT"
        for name in SECRET_NAMES:
            require(bool(os.environ.get(name)), f"SECRET_MISSING_{name}")
        self.key_id = os.environ.get("NCL01_ASC_KEY_ID", "")
        self.issuer = os.environ.get("NCL01_ASC_ISSUER_ID", "")
        require(re.fullmatch(r"[A-Za-z0-9]{10}", self.key_id), "ASC_KEY_ID_REQUIRED")
        require(re.fullmatch(r"[a-fA-F0-9-]{36}", self.issuer), "ASC_TEAM_KEY_ISSUER_REQUIRED")
        profile_path = self.private_file("app.mobileprovision", base64.b64decode(
            "".join(os.environ["NCL01_APPSTORE_PROFILE_BASE64"].split()), validate=True))
        profile = plistlib.loads(self.run(["security", "cms", "-D", "-i", str(profile_path)]))
        self.identity = validate_profile(profile)
        self.profile_uuid = profile["UUID"]
        p12 = self.private_file("distribution.p12", base64.b64decode(
            "".join(os.environ["NCL01_DISTRIBUTION_P12_BASE64"].split()), validate=True))
        self.keychain = self.temp / "signing.keychain-db"
        keychain_password = secrets.token_urlsafe(32)
        self.previous_keychains = shlex.split(self.run(["security", "list-keychains", "-d", "user"]).decode())
        self.save_ownership()
        self.run(["security", "create-keychain", "-p", keychain_password, str(self.keychain)])
        self.run(["security", "set-keychain-settings", "-lut", "21600", str(self.keychain)])
        self.run(["security", "unlock-keychain", "-p", keychain_password, str(self.keychain)])
        self.run(["security", "import", str(p12), "-P", os.environ["NCL01_DISTRIBUTION_P12_PASSWORD"],
                  "-A", "-t", "cert", "-f", "pkcs12", "-k", str(self.keychain)])
        self.run(["security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-k", keychain_password, str(self.keychain)])
        self.run(["security", "list-keychains", "-d", "user", "-s", str(self.keychain), *self.previous_keychains])
        identities = self.run(["security", "find-identity", "-v", "-p", "codesigning", str(self.keychain)]).decode()
        require(self.identity in identities and "Apple Distribution:" in identities, "PROFILE_CERTIFICATE_PRIVATE_KEY_UNAVAILABLE")
        # Xcode 16+ location plus legacy lookup; install only owned UUID files.
        for relative in ("Library/Developer/Xcode/UserData/Provisioning Profiles", "Library/MobileDevice/Provisioning Profiles"):
            directory = Path.home() / relative
            directory.mkdir(parents=True, exist_ok=True)
            installed = directory / f"{self.profile_uuid}.mobileprovision"
            require(not installed.exists(), "PROFILE_DESTINATION_ALREADY_EXISTS")
            self.installed_profiles.append(installed)
            self.save_ownership()
            shutil.copyfile(profile_path, installed)
            installed.chmod(0o600)
        self.configure_api()
        self.receipt["profileValidated"] = True
        self.receipt["certificateSha1"] = self.identity

    def configure_api(self):
        self.key_id = os.environ.get("NCL01_ASC_KEY_ID", "")
        self.issuer = os.environ.get("NCL01_ASC_ISSUER_ID", "")
        require(re.fullmatch(r"[A-Za-z0-9]{10}", self.key_id), "ASC_KEY_ID_REQUIRED")
        require(re.fullmatch(r"[a-fA-F0-9-]{36}", self.issuer), "ASC_TEAM_KEY_ISSUER_REQUIRED")
        require(bool(os.environ.get("NCL01_ASC_PRIVATE_KEY_P8")), "ASC_PRIVATE_KEY_REQUIRED")
        keys = self.temp / "asc"
        keys.mkdir(mode=0o700)
        self.api_key = keys / f"AuthKey_{self.key_id}.p8"
        self.api_key.write_text(os.environ["NCL01_ASC_PRIVATE_KEY_P8"], encoding="utf-8")
        self.api_key.chmod(0o600)
        self.run(["openssl", "pkey", "-in", str(self.api_key), "-noout", "-check"])

    def verify_app_signing(self, project):
        self.stage = "SIGNING_SETTINGS_VALIDATION"
        targets = json.loads(self.run([
            "xcodebuild", "-quiet", "-showBuildSettings", "-json", "-project", str(project),
            "-scheme", "LandfallCompanion", "-configuration", "Release", "-destination", "generic/platform=iOS",
        ]))
        apps = [target for target in targets if target.get("target") == "LandfallCompanion"]
        require(len(apps) == 1, "SINGLE_APP_TARGET_REQUIRED")
        settings = apps[0]["buildSettings"]
        for name, expected in {
            "CODE_SIGNING_ALLOWED": "YES", "CODE_SIGN_STYLE": "Manual", "DEVELOPMENT_TEAM": TEAM,
            "CODE_SIGN_IDENTITY": self.identity, "PROVISIONING_PROFILE_SPECIFIER": self.profile_uuid,
        }.items():
            require(settings.get(name) == expected, f"APP_SIGNING_SETTING_INVALID_{name}")
        self.receipt["appTargetSigningSettingsValidated"] = True

    def archive(self):
        self.stage = "TOOLCHAIN"
        require(sys.platform == "darwin", "MACOS_REQUIRED")
        require(self.run(["git", "rev-parse", "HEAD"]).decode().strip() == self.args.candidate, "CANDIDATE_CHECKOUT_MISMATCH")
        xcode = self.run(["xcodebuild", "-version"]).decode().strip()
        match = re.search(r"Xcode (\d+)\.", xcode)
        require(match and int(match[1]) >= 26 and "beta" not in xcode.lower(), "XCODE_26_RELEASE_REQUIRED")
        self.receipt["xcode"] = xcode
        self.receipt["iphoneosSdk"] = self.run(["xcrun", "--sdk", "iphoneos", "--show-sdk-version"]).decode().strip()
        require(int(self.receipt["iphoneosSdk"].split(".")[0]) >= 26, "IOS_26_SDK_REQUIRED")
        help_result = subprocess.run(["xcrun", "altool", "--help"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        help_text = (help_result.stdout + help_result.stderr).decode("utf-8", errors="replace")
        (self.public / "altool-help.log").write_text(help_text, encoding="utf-8")
        self.explicit_p8 = "--p8-file-path" in help_text
        require(self.explicit_p8 or "API_PRIVATE_KEYS_DIR" in help_text, "ALTOOL_KEY_LOOKUP_UNVERIFIED")
        self.receipt["altoolKeyLookup"] = "EXPLICIT_P8_PATH" if self.explicit_p8 else "API_PRIVATE_KEYS_DIR"
        if self.args.mode == "upload":
            self.configure_signing()
        spec = self.root / "native/ios/project.yml"
        if self.args.mode == "upload":
            spec = self.private_file("signed-project.json", json.dumps(
                signing_overlay(self.root, self.identity, self.profile_uuid)).encode("utf-8"))
        self.stage = "PROJECT_GENERATION"
        project_root = self.root / "native/ios"
        self.run(["xcodegen", "generate", "--spec", str(spec),
                  "--project-root", str(project_root), "--project", str(project_root)], public_log=True)
        project = self.root / "native/ios/LandfallCompanion.xcodeproj"
        if self.args.mode == "upload":
            self.verify_app_signing(project)
        self.stage = "DEVICE_ARCHIVE"
        self.archive_path = self.temp / "LandfallCompanion.xcarchive"
        args = ["xcodebuild", "-quiet", "-project", str(project), "-scheme", "LandfallCompanion", "-configuration", "Release",
                "-destination", "generic/platform=iOS", "-archivePath", str(self.archive_path),
                "-derivedDataPath", str(self.temp / "DerivedData"), "archive",
                f"MARKETING_VERSION={self.args.version}", f"CURRENT_PROJECT_VERSION={self.args.build}",
                f"LANDFALL_ORIGIN={self.args.origin}", f"LANDFALL_HOST={self.args.host}"]
        if self.args.mode == "unsigned":
            args.append("CODE_SIGNING_ALLOWED=NO")
        self.run(args, public_log=True)
        self.stage = "ARCHIVE_VALIDATION"
        app = self.archive_path / "Products/Applications/LandfallCompanion.app"
        info = plistlib.loads((app / "Info.plist").read_bytes())
        require(info.get("CFBundleIdentifier") == BUNDLE, "ARCHIVE_BUNDLE_MISMATCH")
        require(info.get("CFBundleShortVersionString") == self.args.version and info.get("CFBundleVersion") == self.args.build, "ARCHIVE_VERSION_MISMATCH")
        require(info.get("LandfallOrigin") == self.args.origin and info.get("WKAppBoundDomains") == [self.args.host], "ARCHIVE_ORIGIN_MISMATCH")
        require(info.get("NSCameraUsageDescription") and info.get("NSLocalNetworkUsageDescription"), "ARCHIVE_PRIVACY_STRINGS_REQUIRED")
        require(not info.get("NSAppTransportSecurity"), "ARCHIVE_ATS_EXCEPTIONS_FORBIDDEN")
        require(info.get("CFBundleIcons", {}).get("CFBundlePrimaryIcon", {}).get("CFBundleIconName") == "AppIcon", "ARCHIVE_APP_ICON_REQUIRED")
        require((app / "PrivacyInfo.xcprivacy").is_file(), "ARCHIVE_PRIVACY_MANIFEST_REQUIRED")
        plistlib.loads((app / "PrivacyInfo.xcprivacy").read_bytes())
        gltf = app / "Frameworks/GLTFKit2.framework"
        require(gltf.is_dir() and (gltf / "PrivacyInfo.xcprivacy").is_file(), "GLTFKIT_PRIVACY_MANIFEST_REQUIRED")
        plistlib.loads((gltf / "PrivacyInfo.xcprivacy").read_bytes())
        self.receipt["deviceArchiveValidated"] = True
        self.receipt["appExecutableSha256"] = hashlib.sha256((app / info["CFBundleExecutable"]).read_bytes()).hexdigest()
        if self.args.mode == "upload":
            self.run(["codesign", "--verify", "--deep", "--strict", str(app)])
            signed = plistlib.loads(self.run(["codesign", "-d", "--entitlements", ":-", str(app)]))
            require(signed.get("application-identifier") == f"{TEAM}.{BUNDLE}" and signed.get("get-task-allow") is False, "SIGNED_APP_ENTITLEMENTS_INVALID")
            require(signed.get("com.apple.developer.nfc.readersession.formats") == ["TAG"], "SIGNED_APP_NFC_FORMAT_INVALID")
        # Neither archives, profiles, private keys nor signing diagnostic bundles are published.

    def token(self):
        encode = lambda value: base64.urlsafe_b64encode(value).rstrip(b"=")
        issued = int(time.time())
        header = encode(json.dumps({"alg": "ES256", "kid": self.key_id, "typ": "JWT"}, separators=(",", ":")).encode())
        payload = encode(json.dumps({"iss": self.issuer, "iat": issued, "exp": issued + 600, "aud": "appstoreconnect-v1"}, separators=(",", ":")).encode())
        signing = header + b"." + payload
        signature = self.run(["openssl", "dgst", "-sha256", "-sign", str(self.api_key)], data=signing)
        return (signing + b"." + encode(signature_raw(signature))).decode()

    def api(self, route, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request("https://api.appstoreconnect.apple.com/v1/" + route, data=data,
                                        headers={"Authorization": "Bearer " + self.token(), "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                contents = response.read()
            return json.loads(contents) if contents else {}
        except urllib.error.HTTPError as error:
            raise Failure(f"ASC_HTTP_{error.code}_{self.stage}") from None

    def app_record(self):
        self.stage = "APP_RECORD_VALIDATION"
        apps = self.api("apps?" + urllib.parse.urlencode({"filter[bundleId]": BUNDLE}))["data"]
        require(len(apps) == 1, "EXACT_APPSTORE_CONNECT_RECORD_REQUIRED")
        self.app_id = apps[0]["id"]
        configured = os.environ.get("NCL01_ASC_APP_ID")
        require(not configured or configured == self.app_id, "ASC_APP_ID_MISMATCH")
        self.receipt["appStoreConnectAppId"] = self.app_id

    def export_upload(self):
        self.app_record()
        self.stage = "APPSTORE_EXPORT"
        options = {"method": "app-store-connect", "destination": "export", "teamID": TEAM, "signingStyle": "manual",
                   "signingCertificate": self.identity, "provisioningProfiles": {BUNDLE: self.profile_uuid},
                   "manageAppVersionAndBuildNumber": False, "stripSwiftSymbols": True, "uploadSymbols": True}
        options_path = self.private_file("ExportOptions.plist", plistlib.dumps(options))
        export = self.temp / "export"
        self.run(["xcodebuild", "-exportArchive", "-archivePath", str(self.archive_path), "-exportPath", str(export),
                  "-exportOptionsPlist", str(options_path)], public_log=True)
        ipas = list(export.glob("*.ipa"))
        require(len(ipas) == 1, "ONE_EXPORTED_IPA_REQUIRED")
        ipa = ipas[0]
        with zipfile.ZipFile(ipa) as bundle:
            matches = [name for name in bundle.namelist() if re.fullmatch(r"Payload/[^/]+\.app/Info.plist", name)]
            require(len(matches) == 1, "EXPORTED_APP_REQUIRED")
            info = plistlib.loads(bundle.read(matches[0]))
            require(info.get("CFBundleIdentifier") == BUNDLE and info.get("CFBundleVersion") == self.args.build, "IPA_IDENTITY_MISMATCH")
        self.receipt["ipaSha256"] = hashlib.sha256(ipa.read_bytes()).hexdigest()
        self.receipt["ipaBytes"] = ipa.stat().st_size
        shutil.copyfile(ipa, self.public / f"VoyageWright-Landfall-{self.args.version}-{self.args.build}.ipa")
        upload_env = {**os.environ, "API_PRIVATE_KEYS_DIR": str(self.api_key.parent)}
        for action in ("validate", "upload"):
            self.stage = f"ASC_{action.upper()}"
            command = altool_command(action, ipa, self.key_id, self.issuer,
                                     self.api_key if self.explicit_p8 else None)
            self.run(command, env=upload_env, altool_result=True)
            self.receipt[f"apple{action.title()}Passed"] = True
        self.receipt["uploadAccepted"] = True
        self.receipt["appleProcessing"] = "WAITING"
        self.save()
        self.observe_processing()

    def observe_processing(self):
        self.stage = "APPLE_PROCESSING"
        deadline = time.monotonic() + 1500
        while time.monotonic() < deadline:
            result = self.api("builds?" + urllib.parse.urlencode({"filter[app]": self.app_id,
                              "filter[version]": self.args.build, "include": "preReleaseVersion", "limit": "100"}))
            versions = {item["id"]: item["attributes"]["version"] for item in result.get("included", []) if item["type"] == "preReleaseVersions"}
            builds = [item for item in result["data"] if versions.get(item["relationships"]["preReleaseVersion"]["data"]["id"]) == self.args.version]
            require(len(builds) <= 1, "ASC_BUILD_AMBIGUOUS")
            if builds:
                build = builds[0]
                state = build["attributes"]["processingState"]
                self.receipt.update({"appleProcessing": state, "appleBuildId": build["id"]})
                self.save()
                if state in ("FAILED", "INVALID"):
                    raise Failure("APPLE_PROCESSING_REJECTED")
                if state == "VALID":
                    self.attach_internal_group(build["id"])
                    return
            time.sleep(30)
        raise Failure("APPLE_PROCESSING_PENDING_RESUME_OBSERVATION")

    def attach_internal_group(self, build_id):
        group_id = os.environ.get("NCL01_INTERNAL_GROUP_ID", "")
        if not group_id:
            self.receipt["internalTesting"] = "OWNER_SELECT_INTERNAL_GROUP_AND_TESTER"
            return
        self.stage = "INTERNAL_GROUP"
        require(re.fullmatch(r"[A-Za-z0-9-]+", group_id), "INTERNAL_GROUP_ID_INVALID")
        group = self.api(f"betaGroups/{group_id}?include=app")["data"]
        require(group["attributes"]["isInternalGroup"] is True and
                group["relationships"]["app"]["data"]["id"] == self.app_id, "INTERNAL_GROUP_APP_MISMATCH")
        route = f"betaGroups/{group_id}/relationships/builds"
        existing = self.api(route)["data"]
        if not any(item["id"] == build_id for item in existing):
            self.api(route, {"data": [{"type": "builds", "id": build_id}]})
        self.receipt["internalTesting"] = "BUILD_ATTACHED_TO_EXISTING_INTERNAL_GROUP"
        self.receipt["internalGroupId"] = group_id

    def save(self):
        (self.public / "receipt.json").write_text(json.dumps(self.receipt, indent=2) + "\n", encoding="utf-8")

    def cleanup(self):
        errors = []
        for profile in self.installed_profiles:
            try:
                profile.unlink(missing_ok=True)
            except OSError:
                errors.append("PROFILE_CLEANUP_FAILED")
        if self.keychain:
            for args in (["security", "list-keychains", "-d", "user", "-s", *self.previous_keychains],
                         ["security", "delete-keychain", str(self.keychain)]):
                if subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
                    errors.append("KEYCHAIN_CLEANUP_FAILED")
        try:
            shutil.rmtree(self.temp)
        except OSError:
            errors.append("TEMP_CLEANUP_FAILED")
        self.receipt["credentialCleanup"] = "PASS" if not errors else "FAIL"
        if errors:
            self.receipt["cleanupErrors"] = errors
        self.save()
        if not errors:
            self.ownership.unlink(missing_ok=True)
        return not errors


def cleanup_owned():
    """Always-step recovery for an interrupted runner, bounded to this job's files."""
    root = Path(os.environ["RUNNER_TEMP"]).resolve()
    record = root / "ncl01-testflight-ownership.json"
    if not record.exists():
        print("NCL01_CREDENTIAL_CLEANUP_ALREADY_COMPLETE")
        return 0
    owner = json.loads(record.read_text(encoding="utf-8"))
    temp = Path(owner["temp"]).resolve()
    require(temp.parent == root and temp.name.startswith("ncl01-testflight-"), "CLEANUP_TEMP_SCOPE_INVALID")
    errors = []
    if owner["keychain"]:
        keychain = Path(owner["keychain"]).resolve()
        require(keychain == temp / "signing.keychain-db", "CLEANUP_KEYCHAIN_SCOPE_INVALID")
        for command in (["security", "list-keychains", "-d", "user", "-s", *owner["previousKeychains"]],
                        ["security", "delete-keychain", str(keychain)]):
            result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if result.returncode:
                errors.append("KEYCHAIN")
    allowed = [(Path.home() / relative).resolve() for relative in (
        "Library/Developer/Xcode/UserData/Provisioning Profiles", "Library/MobileDevice/Provisioning Profiles")]
    for value in owner["profiles"]:
        profile = Path(value).resolve()
        require(profile.parent in allowed and re.fullmatch(r"[A-Fa-f0-9-]{36}\.mobileprovision", profile.name), "CLEANUP_PROFILE_SCOPE_INVALID")
        try:
            profile.unlink(missing_ok=True)
        except OSError:
            errors.append("PROFILE")
    try:
        shutil.rmtree(temp)
    except OSError:
        errors.append("TEMP")
    require(not errors, "CREDENTIAL_CLEANUP_FAILED")
    record.unlink()
    print("NCL01_CREDENTIAL_CLEANUP_PASS")
    return 0


def main():
    if sys.argv[1:] == ["--cleanup-owned"]:
        return cleanup_owned()
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("unsigned", "upload", "observe"), required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--origin", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--build", required=True)
    args = parser.parse_args()
    require(re.fullmatch(r"[a-f0-9]{40}", args.candidate), "CANDIDATE_INVALID")
    require(re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", args.version), "VERSION_INVALID")
    require(re.fullmatch(r"[1-9][0-9]{0,3}(\.[0-9]{1,2}){0,2}", args.build), "BUILD_INVALID")
    args.origin, args.host = validate_origin(args.origin)
    runner = Runner(args)
    success = False
    try:
        if args.mode == "observe":
            require(sys.platform == "darwin", "MACOS_REQUIRED")
            require(runner.run(["git", "rev-parse", "HEAD"]).decode().strip() == args.candidate, "CANDIDATE_CHECKOUT_MISMATCH")
            runner.configure_api()
            runner.app_record()
            runner.observe_processing()
        else:
            runner.archive()
            if args.mode == "upload":
                runner.export_upload()
        runner.receipt["result"] = "PASS"
        success = True
    except Exception as error:
        label = str(error) if isinstance(error, Failure) else "UNEXPECTED_RUNNER_FAILURE"
        runner.receipt.update({"result": "FAIL", "failureStage": runner.stage, "error": label})
        print(f"NCL01_{label}", file=sys.stderr)
    finally:
        success = runner.cleanup() and success
    print(json.dumps(runner.receipt, indent=2))
    return 0 if success else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Failure as error:
        print(f"NCL01_{error}", file=sys.stderr)
        sys.exit(1)
