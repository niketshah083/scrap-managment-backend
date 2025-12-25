import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";
import * as express from "express";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase body parser limits for large payloads (e.g., file uploads, PDF generation)
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));

  // Serve static files from uploads folder
  app.use("/uploads", express.static(join(process.cwd(), "uploads")));

  // Enable CORS for frontend
  app.enableCors({
    origin: "*", // Frontend URL
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    credentials: true,
  });
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // API prefix
  app.setGlobalPrefix("api/v1");

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("Scrap Operations Platform API")
    .setDescription(
      "Multi-tenant SaaS platform for scrap industry operations control and compliance"
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Scrap Operations Platform API running on port ${port}`);
  console.log(
    `📚 API Documentation available at http://localhost:${port}/api/docs`
  );
}
bootstrap();
