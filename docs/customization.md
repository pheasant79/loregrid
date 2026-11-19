# Customization

Copy `data/templates/minimal-template-v2.json`, choose a stable tree ID, and replace the fictional content. A tree is defined by tabs, nodes, resources, and relations; the application has no subject-specific constants.

Use tabs for durable areas that deserve independent reading and layout, such as foundations, fieldwork, analysis, language, design, or professional practice. Every node has one primary tab. Cross-tab required dependencies automatically become proxies.

Use hard prerequisites sparingly. A topic merely being useful, common in a course, or historically earlier does not make it required. Prefer `recommended` for directed non-gating development and `related` for contextual association.

Optional `layout.groupId`, `layout.order`, and `layout.stage` values may stabilize presentation, but never assign x/y coordinates. Loregrid computes node positions from dependencies.

Tab colors accept six-digit hex values. The UI itself is bilingual Chinese/English; tree titles and content are authored in the tree's chosen language.
