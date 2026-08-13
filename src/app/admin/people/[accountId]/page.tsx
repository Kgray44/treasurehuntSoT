import { notFound } from "next/navigation";
import { admiraltyPageOperator } from "@/admiralty/page-authorization";
import { getAccountDossier } from "@/admiralty/ports/wayfarer-admin-read";
import {
  ChartroomPage,
  DetailList,
  EmptyState,
  EvidenceStrip,
  Identifier,
  Panel,
  StatusBadge,
  dateTime,
  humanize,
} from "@/components/admiralty/AdminPrimitives";
import { DossierSupportPanel } from "@/components/admiralty/DossierSupportPanel";
import { SessionActionPanel } from "@/components/admiralty/SessionActionPanel";

export default async function AccountDossierPage({ params }: { params: Promise<{ accountId: string }> }) {
  const operator = await admiraltyPageOperator("ACCOUNT_OBSERVE");
  const { accountId } = await params;
  const dossier = await getAccountDossier(operator, accountId);
  if (!dossier?.data) notFound();
  const account = dossier.data;
  const observedAt = new Date(dossier.evidence.observedAt).getTime();
  const activeGrant = account.supportRequestsTargeted.find(
    (request) =>
      request.grant?.status === "ACTIVE" &&
      !request.grant.revokedAt &&
      new Date(request.grant.expiresAt).getTime() > observedAt,
  )?.grant;
  return (
    <ChartroomPage
      eyebrow="Account dossier"
      title={account.profile?.displayName ?? "Profile not available"}
      description="A human-readable, auditable account projection from Wayfarer. Private prose and credential material are not returned."
    >
      <div className="chartroom-identity">
        <div>
          <StatusBadge state={account.status} />
          <h2>{account.profile?.handle ? `@${account.profile.handle}` : "Handle not available"}</h2>
        </div>
        <Identifier value={account.id} label="account ID" />
      </div>
      <div className="chartroom-grid">
        <Panel title="Overview">
          <DetailList
            items={[
              { label: "Account state", value: <StatusBadge state={account.status} /> },
              { label: "Claimed", value: dateTime(account.claimedAt) },
              { label: "Last seen", value: dateTime(account.lastSeenAt) },
              { label: "Created", value: dateTime(account.createdAt) },
              { label: "Updated", value: dateTime(account.updatedAt) },
              { label: "Support access", value: <StatusBadge state={account.supportAccessState} /> },
            ]}
          />
        </Panel>
        <Panel title="Identity">
          <DetailList
            items={account.emails.map((email) => ({
              label: email.isPrimary ? "Primary email" : "Email",
              value: (
                <>
                  {email.displayEmail} · {humanize(email.verificationState)} · {dateTime(email.verifiedAt)}
                </>
              ),
            }))}
          />
        </Panel>
        <Panel title="Roles & capabilities">
          {account.roles.length ? (
            <div className="chartroom-list">
              {account.roles.map((role) => (
                <article key={`${role.role}-${role.scopeType}-${role.grantedAt.toISOString()}`}>
                  <strong>{humanize(role.role)}</strong>
                  <span>
                    {role.scopeType}
                    {role.scopeId ? ` · ${role.scopeId}` : ""}
                  </span>
                  <small>
                    {role.revokedAt ? `Revoked ${dateTime(role.revokedAt)}` : `Granted ${dateTime(role.grantedAt)}`}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No role assignments" />
          )}
        </Panel>
        <Panel title="Linked identities">
          {account.externalIdentities.length ? (
            <div className="chartroom-list">
              {account.externalIdentities.map((identity) => (
                <article key={identity.id}>
                  <strong>{humanize(identity.provider)}</strong>
                  <Identifier value={identity.providerAccountId} label={`${identity.provider} subject`} />
                  <span>
                    {identity.providerDisplayName ?? "Provider name not available"} · {humanize(identity.status)}
                  </span>
                  <small>
                    Linked {dateTime(identity.linkedAt)} · Last verified {dateTime(identity.lastVerifiedAt)}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No linked identity" detail="No canonical provider identity is recorded." />
          )}
        </Panel>
      </div>
      <Panel title="Sessions & devices" kicker="Identifiers, token hashes, and CSRF values excluded">
        {account.sessions.length ? (
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Type</th>
                  <th>State</th>
                  <th>Last seen</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {account.sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.deviceLabel ?? "Device not recorded"}</td>
                    <td>{humanize(session.sessionType)}</td>
                    <td>
                      <StatusBadge
                        state={
                          session.revokedAt
                            ? "REVOKED"
                            : new Date(session.expiresAt).getTime() <= observedAt
                              ? "EXPIRED"
                              : "HEALTHY"
                        }
                      />
                    </td>
                    <td>{dateTime(session.lastSeenAt)}</td>
                    <td>{dateTime(session.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No sessions recorded" />
        )}
      </Panel>
      <Panel title="Recent authentication & security activity">
        {account.securityEvents.length ? (
          <div className="chartroom-timeline">
            {account.securityEvents.map((event) => (
              <article key={event.id}>
                <span aria-hidden="true" />
                <div>
                  <strong>{humanize(event.eventType)}</strong>
                  <p>
                    {dateTime(event.createdAt)} · {event.correlationId ?? "No correlation ID"}
                  </p>
                  {Object.keys(event.detail).length ? (
                    <details>
                      <summary>Safe technical detail</summary>
                      <pre>{JSON.stringify(event.detail, null, 2)}</pre>
                    </details>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No security events recorded" />
        )}
      </Panel>
      <Panel title="Security actions" kicker="Preview, recent assurance, explicit confirmation, owner command, and receipt">
        <SessionActionPanel
          targetAccountId={account.id}
          csrfToken={operator.csrfToken}
          sessions={account.sessions}
          enabled={operator.capabilities.includes("SECURITY_OPERATE")}
        />
      </Panel>
      <div className="chartroom-grid">
        <Panel title="Chronicle activity">
          {account.profile?.chronicleRecords.length ? (
            <div className="chartroom-list">
              {account.profile.chronicleRecords.map((record) => (
                <article key={record.id}>
                  <strong>{record.chronicleTitleSnapshot}</strong>
                  <span>
                    {humanize(record.lifecycleStatus)} · {humanize(record.outcome)}
                  </span>
                  <small>
                    {record.participationRole} · {dateTime(record.completedAt ?? record.startedAt)}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No Chronicle history" />
          )}
        </Panel>
        <Panel title="Community activity">
          <DetailList
            items={
              account.communityProfile
                ? [
                    { label: "Creator state", value: humanize(account.communityProfile.creatorStatus) },
                    { label: "Moderation state", value: humanize(account.communityProfile.moderationStatus) },
                    { label: "Verification", value: humanize(account.communityProfile.verificationStatus) },
                    { label: "Listings", value: account.communityProfile._count.listings },
                    { label: "Last published", value: dateTime(account.communityProfile.lastPublishedAt) },
                  ]
                : [{ label: "Community profile", value: "No data recorded" }]
            }
          />
        </Panel>
        <Panel title="Lifecycle">
          {account.lifecycleRequests.length ? (
            <div className="chartroom-list">
              {account.lifecycleRequests.map((request) => (
                <article key={request.id}>
                  <strong>{humanize(request.kind)}</strong>
                  <StatusBadge state={request.state} />
                  <small>
                    Requested {dateTime(request.requestedAt)} · Scheduled {dateTime(request.scheduledFor)}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No lifecycle action recorded" />
          )}
        </Panel>
        <Panel title="Technical evidence">
          <DetailList
            items={[
              { label: "Account ID", value: <Identifier value={account.id} /> },
              {
                label: "Profile ID",
                value: account.profile ? <Identifier value={account.profile.id} /> : "Not available",
              },
              { label: "Data classification", value: dossier.evidence.dataClass },
              { label: "Source", value: dossier.evidence.source },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Support access" kicker="Phase 1 consent controls, now anchored to this dossier">
        <DossierSupportPanel
          targetAccountId={account.id}
          csrfToken={operator.csrfToken}
          canRequest={operator.capabilities.includes("SUPPORT_REQUEST")}
          canUse={operator.capabilities.includes("SUPPORT_USE")}
          activeGrantId={activeGrant?.id}
        />
        {account.supportRequestsTargeted.length ? (
          <div className="chartroom-table-wrap" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Purpose</th>
                  <th>Scopes</th>
                  <th>State</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {account.supportRequestsTargeted.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <Identifier value={request.id} label="support request ID" />
                    </td>
                    <td>{request.purpose}</td>
                    <td>{request.requestedScopes.join(", ")}</td>
                    <td>
                      <StatusBadge state={request.grant?.status ?? request.status} />
                    </td>
                    <td>{dateTime(request.grant?.expiresAt ?? request.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
      <EvidenceStrip evidence={dossier.evidence} />
    </ChartroomPage>
  );
}
