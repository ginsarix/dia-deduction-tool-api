export type DiaSuccessResponse<T> = {
  code: string;
  result: T;
};

export type DiaErrorResponse = {
  code: string;
  msg: string;
};

export type DiaResponse<T> = DiaSuccessResponse<T> | DiaErrorResponse;

export type DiaLoginResponse = {
  code: string;
  msg: string;
};

export type DiaPingResponse = {
  code: "200" | "401";
  /**
   * will be undefined if response code is 200
   */
  msg?: "INVALID_SESSION";
};

export type DiaWorker = {
  adisoyadi: string;
  _key: string;
};

// the comments are the equivalent display names in the dia app (not capitalized and ascii)
export type DiaWorkerTally = {
  _key_per_personel: string;
  // M
  muhasebelesme: string;
  // duzenleme t.
  duzenlemetarihi: string;
  // departman
  persdepartmanaciklama: string;
  adi: string;
  soyadi: string;
  tckimlikno: string;
  sube: string;
  // yontem
  ucretturu: "N" | "B";
  toplamsigortagun: string;
  // arge sigorta gun
  argefaaliyetgunsayisi: string;
  // arge gv gun
  argegelirvergisigunsayisi: string;
  // brut kazanc
  aylikbrutkazanc: string;
  // arge brut kazanc
  argebrutucret: string;
  // arge brut kazanc farki
  argebrutkazancfarki: string;
  // isci ssk
  toplamiscisskprimtutari: string;
  // issizlik isci
  issizlikiscipayitutari: string;
  // g.v. matrahi
  gelirvergisimatrahi: string;
  // arge g.v. matrahi
  argegelirvergisimatrahi: string;
  // + g.v. matrahi
  artigvmatrahi: string;
  // gelir vergisi
  gelirvergisitutari: string;
  // arge gelir vergisi
  argegelirvergisitutari: string;
  // g.v. istisna
  gvistisnatutari: string;
  // asgari ucret g.v. istisna
  asgariucretgvistisnasi: string;
  // arge asgari ucret g.v. istisna
  argeasgariucretgvistisnasi: string;
  // asgari ucret d.v. istisna
  asgariucretdvistisnasi: string;
  // arge asgari ucret d.v. istisnac
  argeasgariucretdvistisnasi: string;
  // odenecek g.v
  odenecekgelirvergisi: string;
  // damga vergisi
  damgavergisitutari: string;
  // odenecek d.v
  odenecekdamgavergisi: string;
  // net kazanc
  ayliknetkazanc: string;

  // odenecek a.g.i.
  mahsupedilecekagi: string;

  // issizlik isv.
  issizlikisverenpayitutari: string;
  // ssk isv.
  toplamisverensskprimtutari: string;

  // icra tutari
  icratutari: string;
  // nafaka tutari
  nafakatutari: string;
  // bes kesinti tutari
  bes_kesinti_tutari: string;
  // cari fis no
  carifisno: string;
  // yemek yardimi (net)
  yemekyardiminet: string;
  // yemek yardimi (brut)
  yemekyardimibrut: string;

  isverenhastalikprimtutari: string;
  isverenihtiyarlikprimtutari: string;
  isverenanalikprimtutari: string;
  isverentehlikederecesiprimtutari: string;
  uzunvadeliskisveren: string;
  gssisveren: string;
  kisavadeliskisveren: string;
  sgk_6111kanunindirimi: string;
  kisavadeliskisveren_muafiyettutari: string;
  uzunvadeliskisveren_muafiyettutari: string;
  gssisveren_muafiyettutari: string;
  artiisverendevlettesviki: string;
  sgk_4447kanunindirimi: string;
  sgk_16322kanunindirimi: string;
  sgk_26322kanunindirimi: string;
  sgk_7252kanunindirimi: string;
  sgk_3294kanunindirimi: string;
  sgk_2828kanunindirimi: string;

  // İşv. Sağlık Sigortası (Brüt)
  isvozelsagliksigortasibrut: string;
  // İşv. Sağlık Sigortası (Net)
  isvozelsagliksigortasinet: string;
};
