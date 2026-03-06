import { URL_BASE } from "../constants/dia.js";
import type { DiaWorkerTally } from "../types/dia-responses.js";

export const createDiaUrl = (serverCode: string, module: string) =>
  `https://${serverCode}.${URL_BASE}/${module}/json`;

// İşv. Maliyeti (Teşviksiz)
export function employerCostWithoutIncentive(p: DiaWorkerTally) {
  return (
    +p.aylikbrutkazanc +
    +p.issizlikisverenpayitutari +
    (+p.isverenhastalikprimtutari +
      +p.isverenihtiyarlikprimtutari +
      +p.isverenanalikprimtutari +
      +p.isverentehlikederecesiprimtutari +
      +p.uzunvadeliskisveren +
      +p.gssisveren +
      +p.kisavadeliskisveren +
      +p.sgk_6111kanunindirimi -
      +p.kisavadeliskisveren_muafiyettutari -
      +p.uzunvadeliskisveren_muafiyettutari -
      +p.gssisveren_muafiyettutari -
      +p.artiisverendevlettesviki)
  );
}

// İşv. Maliyeti (Teşvikli)
export function employerCostWithIncentive(p: DiaWorkerTally) {
  return (
    employerCostWithoutIncentive(p) -
    +p.sgk_4447kanunindirimi -
    +p.sgk_16322kanunindirimi -
    +p.sgk_6111kanunindirimi -
    +p.sgk_26322kanunindirimi -
    +p.sgk_7252kanunindirimi -
    +p.sgk_3294kanunindirimi -
    +p.sgk_2828kanunindirimi
  );
}
