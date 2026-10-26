import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { envValidationSchema } from './env.validation';
// Global configuration module. Validates the environment at boot (fails fast with a precise message) and…
// exposes a typed, immutable configuration object through `ConfigService`. `ConfigModule.forRoot` is `isGlobal:…
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      cache: true,
    }),
  ],
})
export class AppConfigModule {}
