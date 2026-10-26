import * as moment from 'moment-timezone';

export const FORMATO_FECHA = 'DD-MM-YYYY';
export const FORMATO_FECHA_HORA = 'DD-MM-YYYY HH:mm:ss';

export const analizarFecha = (
  texto: string,
  zona: string,
): moment.Moment | null => {
  const fecha = moment.tz(texto, FORMATO_FECHA, true, zona);
  return fecha.isValid() ? fecha : null;
};

export const analizarFechaHora = (
  texto: string,
  zona: string,
): moment.Moment | null => {
  const fecha = moment.tz(texto, FORMATO_FECHA_HORA, true, zona);
  return fecha.isValid() ? fecha : null;
};

export const rangoDelDia = (fecha: Date, zona: string) => {
  const dia = moment.tz(fecha, zona);
  return {
    inicio: dia.clone().startOf('day').toDate(),
    fin: dia.clone().endOf('day').toDate(),
  };
};

export const mismoDia = (a: Date, b: Date, zona: string): boolean =>
  moment.tz(a, zona).isSame(moment.tz(b, zona), 'day');

export const formatearFechaHora = (fecha: Date, zona: string): string =>
  moment.tz(fecha, zona).format(FORMATO_FECHA_HORA);

export const rangoDeLaSemana = (ahora: Date, zona: string) => {
  const dia = moment.tz(ahora, zona);
  return {
    inicio: dia.clone().startOf('isoWeek').toDate(),
    fin: dia.clone().endOf('isoWeek').toDate(),
  };
};
