import { MigrationInterface, QueryRunner } from 'typeorm';

export class Inicial1793018283771 implements MigrationInterface {
  name = 'Inicial1793018283771';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."marcajes_type_enum" AS ENUM('entry', 'exit')`,
    );
    await queryRunner.query(
      `CREATE TABLE "marcajes" ("id" SERIAL NOT NULL, "id_user" integer NOT NULL, "date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."marcajes_type_enum" NOT NULL DEFAULT 'entry', "adminFlag" boolean NOT NULL DEFAULT false, "latCoordinate" character varying(32), "longCoordinate" character varying(32), CONSTRAINT "PK_e13465eafa18b39fbbb30300e14" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a0ae73c8a120d3ecbf2bcd0b59" ON "marcajes" ("id_user", "date") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a0ae73c8a120d3ecbf2bcd0b59"`,
    );
    await queryRunner.query(`DROP TABLE "marcajes"`);
    await queryRunner.query(`DROP TYPE "public"."marcajes_type_enum"`);
  }
}
