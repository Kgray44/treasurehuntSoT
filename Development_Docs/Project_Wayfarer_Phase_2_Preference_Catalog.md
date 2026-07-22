# Project Wayfarer Phase 2 Preference Catalog

`PreferenceV1` stores experience motion, text scale, theme, captions, transcripts, audio description, autoplay, contrast, texture intensity, and low-bandwidth media; discovery searchability/themes/content warnings; social invitation and provider-discovery rules; notification choices; and the profile default visibility.

The resolver precedence is mandatory/browser accessibility requirement, temporary Chronicle override, then stored account V1 value. Chronicle overrides are runtime values and never update the stored account preference. Legacy generic JSON is read once through a defensive mapper and upserted as V1; application callers never consume it directly.
