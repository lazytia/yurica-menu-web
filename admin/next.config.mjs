 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/admin/next.config.mjs b/admin/next.config.mjs
index 667b41501446bd2f8cc7119f66df116115c76576..bf221d35fdb91e610f05e63d105e926869c02148 100644
--- a/admin/next.config.mjs
+++ b/admin/next.config.mjs
@@ -1,5 +1,6 @@
 /** @type {import('next').NextConfig} */
 const nextConfig = {
-  experimental: { appDir: true },
+  output: 'export',
 };
+
 export default nextConfig;
 
EOF
)
