import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: ['log', 'error', 'warn'] },
  );
  await app.register(multipart as any, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max file size
      files: 10, // Allow up to 10 files
    },
  });

  // Security headers with Helmet
  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // For Swagger UI
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny', // Keep strict default on all endpoints
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    crossOriginEmbedderPolicy: false, // For MinIO compatibility
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const corsOrigins = configService.get<string>('FRONTEND_ORIGIN');
  const allowedOrigins = corsOrigins
    ? corsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
    : true;
  const swaggerFrameAncestorsRaw = configService.get<string>('SWAGGER_FRAME_ANCESTORS');
  const swaggerFrameAncestors = swaggerFrameAncestorsRaw
    ? swaggerFrameAncestorsRaw
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => /^https?:\/\/[^,\s]+$/i.test(origin))
    : Array.isArray(allowedOrigins)
      ? allowedOrigins
      : [];
  if (nodeEnv === 'production' && !corsOrigins) {
    throw new Error('FRONTEND_ORIGIN is required in production');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerEnabledRaw = configService.get<string>('SWAGGER_ENABLED');
  const swaggerEnabled = swaggerEnabledRaw
    ? swaggerEnabledRaw.toLowerCase() === 'true'
    : true;
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Qubeless API')
      .setDescription(
        'API Qubeless : analyses de code, Quality Gates, analyzers, webhooks PR. Auth JWT ou token API (Bearer).',
      )
      .setVersion('0.1.0')
      .setContact('Qubeless', 'https://qubeless.local', 'brieuc.vably@protonmail.com')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addServer('http://localhost:3001', 'Local')
      .addServer('http://127.0.0.1:3001', 'Local (127.0.0.1)')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);

    // Allow embedding Swagger UI from configured origins while keeping strict headers elsewhere.
    const fastifyInstance = app.getHttpAdapter().getInstance();
    (fastifyInstance as any).addHook(
      'onSend',
      (request: any, reply: any, payload: any, done: (error: Error | null, payload: any) => void) => {
        const requestUrl = request.raw?.url ?? '';
        if (requestUrl.startsWith('/api/docs')) {
          const frameAncestors = [`'self'`, ...swaggerFrameAncestors].join(' ');
          reply.raw?.removeHeader?.('x-frame-options');
          reply.header(
            'content-security-policy',
            `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none'; frame-ancestors ${frameAncestors};`,
          );
        }
        done(null, payload);
      },
    );
  }

  const authService = app.get(AuthService);
  await authService.ensureAdminUser();

  const port = configService.get<number>('PORT') ?? 3001;
  const host = configService.get<string>('HOST') ?? '0.0.0.0';
  await app.listen(port, host);
}

bootstrap();
