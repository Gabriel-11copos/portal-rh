// Calcula a data da Páscoa de um ano (algoritmo de Gauss/Meeus).
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function somarDias(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

function chaveData(d) {
  return d.toISOString().slice(0, 10);
}

// Feriados nacionais fixos + móveis (Carnaval, Sexta-feira Santa, Corpus Christi —
// tratados como não úteis por convenção, já que a maioria das operações do grupo
// fecha ou reduz o expediente administrativo nessas datas).
function feriadosNacionais(ano) {
  const pascoa = calcularPascoa(ano);
  const fixos = [
    [0, 1],   // Confraternização Universal
    [3, 21],  // Tiradentes
    [4, 1],   // Dia do Trabalho
    [8, 7],   // Independência
    [9, 12],  // Nossa Senhora Aparecida
    [10, 2],  // Finados
    [10, 15], // Proclamação da República
    [10, 20], // Consciência Negra
    [11, 25], // Natal
  ];
  const datas = fixos.map(([m, d]) => new Date(ano, m, d));
  datas.push(somarDias(pascoa, -48)); // Segunda de Carnaval
  datas.push(somarDias(pascoa, -47)); // Terça de Carnaval
  datas.push(somarDias(pascoa, -2));  // Sexta-feira Santa
  datas.push(somarDias(pascoa, 60));  // Corpus Christi
  return new Set(datas.map(chaveData));
}

const cachePorAno = {};

function ehFeriado(data) {
  const ano = data.getFullYear();
  if (!cachePorAno[ano]) cachePorAno[ano] = feriadosNacionais(ano);
  return cachePorAno[ano].has(chaveData(data));
}

// Soma dias úteis a uma data, pulando sábados, domingos e feriados nacionais.
function somarDiasUteis(dataBase, dias) {
  const data = new Date(dataBase);
  let restantes = dias;
  while (restantes > 0) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay(); // 0 = domingo, 6 = sábado
    if (diaSemana !== 0 && diaSemana !== 6 && !ehFeriado(data)) restantes--;
  }
  return data;
}

module.exports = { somarDiasUteis, ehFeriado };
