# Community 2D and 3D Artifact Architecture

2D items accept safe raster media only, require matching declared/detected MIME, a licence snapshot, alt text, and a bounded byte size. EXIF/GPS data is rejected before publication. Collections reference immutable package item IDs only.

3D items accept binary GLB 2.0 only. Validation checks magic, version, length, JSON chunk, structural JSON, buffer/accessor bounds, finite transforms and bounds, no external URI, no unapproved extension, bounded triangles/textures, poster and accessible description. An invalid or failed preview always falls back to poster plus descriptive text; keyboard inspection changes only local view state. Assemblies validate unique components, dependency closure, transforms, completion rules, licences and attribution closure.
