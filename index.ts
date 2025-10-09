import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import connectDB from "./config/db";
import courseRoutes from "./routes/CourseRoute";
import authRoutes from "./routes/AuthRoute";
import paymentRoutes from "./routes/PaymentRoute";
import orderRoutes from "./routes/OrderRoute";
import videoRoutes from "./routes/VideoRoute";
import { quizController } from "./controlers/quizController";
import { certificateController } from "./controlers/certificateController";
import path from "path";

// Connect to MongoDB
connectDB();

const app = new Elysia()
    .onRequest(({ request, set }) => {
        // Add CORS headers to every request
        set.headers['access-control-allow-origin'] = '*';
        set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
        set.headers['access-control-allow-headers'] = 'Content-Type, Authorization, Accept';
        set.headers['access-control-allow-credentials'] = 'true';
    })
    .options('/*', ({ set }) => {
        // Handle preflight requests
        set.headers['access-control-allow-origin'] = '*';
        set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
        set.headers['access-control-allow-headers'] = 'Content-Type, Authorization, Accept';
        set.headers['access-control-allow-credentials'] = 'true';
        set.status = 204;
        return '';
    })
    // Serve static files from uploads directory
    .get("/uploads/*", async ({ params }) => {
        const filePath = path.join(process.cwd(), "uploads", params["*"]);
        try {
            const file = Bun.file(filePath);
            if (await file.exists()) {
                return new Response(file);
            }
            return new Response("File not found", { status: 404 });
        } catch (error) {
            return new Response("Error serving file", { status: 500 });
        }
    })
    .use(courseRoutes)
    .use(authRoutes)
    .use(paymentRoutes)
    .use(orderRoutes)
    .use(videoRoutes)
    .use(quizController)
    .use(certificateController)
    // Serve static assets (JS, CSS, images, etc.)
    .get("/assets/*", async ({ params }) => {
        const filePath = path.join(process.cwd(), "/dist/assets", params["*"]);
        try {
            const file = Bun.file(filePath);
            if (await file.exists()) {
                // Determine content type based on file extension
                const ext = path.extname(filePath).toLowerCase();
                const contentTypes: Record<string, string> = {
                    '.js': 'application/javascript',
                    '.mjs': 'application/javascript',
                    '.css': 'text/css',
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                    '.ico': 'image/x-icon',
                    '.woff': 'font/woff',
                    '.woff2': 'font/woff2',
                    '.ttf': 'font/ttf',
                    '.eot': 'application/vnd.ms-fontobject'
                };
                const contentType = contentTypes[ext] || 'application/octet-stream';
                
                return new Response(file, {
                    headers: { "Content-Type": contentType }
                });
            }
            return new Response("File not found", { status: 404 });
        } catch (error) {
            return new Response("Error serving file", { status: 500 });
        }
    })
    // Serve other static files from root (like vite.svg)
    .get("/:file", async ({ params }) => {
        const fileName = params.file;
        // Only serve specific static files, not all routes
        if (fileName.includes('.')) {
            const filePath = path.join(process.cwd(), "/dist", fileName);
            try {
                const file = Bun.file(filePath);
                if (await file.exists()) {
                    return new Response(file);
                }
            } catch (error) {
                // File doesn't exist, continue to index.html
            }
        }
        // If not a static file, serve index.html for SPA routing
        const indexPath = path.join(process.cwd(), "/dist/index.html");
        try {
            const file = Bun.file(indexPath);
            if (await file.exists()) {
                return new Response(file, {
                    headers: { "Content-Type": "text/html" }
                });
            }
            return new Response("Frontend not found. Please build the client first.", { status: 404 });
        } catch (error) {
            return new Response("Error serving frontend", { status: 500 });
        }
    })
    // Serve index.html for all other unmatched routes (SPA support)
    .get("/*", async () => {
        const indexPath = path.join(process.cwd(), "/dist/index.html");
        try {
            const file = Bun.file(indexPath);
            if (await file.exists()) {
                return new Response(file, {
                    headers: { "Content-Type": "text/html" }
                });
            }
            return new Response("Frontend not found. Please build the client first.", { status: 404 });
        } catch (error) {
            return new Response("Error serving frontend", { status: 500 });
        }
    })
    .listen(process.env.PORT || 8080, () => { 
        console.log(`🦊 Elysia is running at http://localhost:${process.env.PORT || 8080}`);
    });
