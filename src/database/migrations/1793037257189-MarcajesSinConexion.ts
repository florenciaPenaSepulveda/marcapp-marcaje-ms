import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarcajesSinConexion1793037257189 implements MigrationInterface {
  name = 'MarcajesSinConexion1793037257189';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "marcajes" ADD "offline" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "marcajes" ADD "clientId" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5dac349639b63679bb1ec4c247" ON "marcajes" ("clientId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5dac349639b63679bb1ec4c247"`,
    );
    await queryRunner.query(`ALTER TABLE "marcajes" DROP COLUMN "clientId"`);
    await queryRunner.query(`ALTER TABLE "marcajes" DROP COLUMN "offline"`);
  }
}
