import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Response } from 'express';
@Catch(QueryFailedError)
export class DatabaseErrorsFilter implements ExceptionFilter {
  private logger = new Logger('Database');
  catch(error: QueryFailedError, host: ArgumentsHost) {
    const driver = error.driverError as { errno?: number };
    const duplicate = driver.errno === 1062;
    this.logger.warn(
      `Database operation rejected (${driver.errno ?? 'unknown'}).`,
    );
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(duplicate ? 409 : 503)
      .json({
        message: duplicate
          ? 'El registro ya existe. Actualiza los datos.'
          : 'No se pudo completar la operación en la base del sistema.',
      });
  }
}
