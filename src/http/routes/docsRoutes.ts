import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "../../docs/openApi";

export function createDocsRoutes(): Router {
  const router = Router();

  router.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  router.get("/openapi.json", (_request, response) => {
    response.json(openApiDocument);
  });

  return router;
}
