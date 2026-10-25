// Overhead: the aircraft over your home right now, from adsb.lol. A port of
// dmellok/tesserae-widget-overhead (Photo/Plate) to a TRMNL Recipe.
//
// Positions come from the Polling URL. Where the sandbox hands this a `fetch`
// (TRMNL Serverless, kuroshiro) it also asks adsbdb for each route and
// planespotters.net for a photograph of the very airframe, keeping what it
// learnt in `trmnl_state` so a regular passes cost nothing the second time.
// Without `fetch` it answers synchronously and the page draws silhouettes.

const SHOW = 5
const DEFAULT_RADIUS_KM = 40
const CONTACT = 'trmnl-overhead/0.2 (+https://github.com/PhyberApex/trmnl-overhead)'
const PHOTO_URL = 'https://api.planespotters.net/pub/photos/reg/'
const ROUTE_URL = 'https://api.adsbdb.com/v0/callsign/'
const LOOKUP_MS = 3200
const STATE_BYTES = 7000
const KEEP_PHOTOS = 24
const KEEP_ROUTES = 40

// ICAO type designator → name, class (the silhouette), wingspan m. From the widget's adsb.py.
const TYPES = {
  A318: ['Airbus A318', 'jet', 34.1], A319: ['Airbus A319', 'jet', 35.8], A320: ['Airbus A320', 'jet', 35.8],
  A20N: ['Airbus A320neo', 'jet', 35.8], A321: ['Airbus A321', 'jet', 35.8], A21N: ['Airbus A321neo', 'jet', 35.8],
  A332: ['Airbus A330-200', 'wide', 60.3], A333: ['Airbus A330-300', 'wide', 60.3], A339: ['Airbus A330-900neo', 'wide', 64.0],
  A342: ['Airbus A340-200', 'wide', 60.3], A343: ['Airbus A340-300', 'wide', 60.3], A346: ['Airbus A340-600', 'wide', 63.5],
  A359: ['Airbus A350-900', 'wide', 64.8], A35K: ['Airbus A350-1000', 'wide', 64.8], A388: ['Airbus A380', 'wide', 79.8],
  A306: ['Airbus A300-600', 'wide', 44.8], A310: ['Airbus A310', 'wide', 43.9],
  B712: ['Boeing 717', 'jet', 28.4], B732: ['Boeing 737-200', 'jet', 28.4], B733: ['Boeing 737-300', 'jet', 28.9],
  B734: ['Boeing 737-400', 'jet', 28.9], B735: ['Boeing 737-500', 'jet', 28.9], B736: ['Boeing 737-600', 'jet', 34.3],
  B737: ['Boeing 737-700', 'jet', 34.3], B738: ['Boeing 737-800', 'jet', 35.8], B739: ['Boeing 737-900', 'jet', 35.8],
  B37M: ['Boeing 737 MAX 7', 'jet', 35.9], B38M: ['Boeing 737 MAX 8', 'jet', 35.9], B39M: ['Boeing 737 MAX 9', 'jet', 35.9],
  B3XM: ['Boeing 737 MAX 10', 'jet', 35.9], B744: ['Boeing 747-400', 'wide', 64.4], B748: ['Boeing 747-8', 'wide', 68.4],
  B752: ['Boeing 757-200', 'jet', 38.0], B753: ['Boeing 757-300', 'jet', 38.0], B762: ['Boeing 767-200', 'wide', 47.6],
  B763: ['Boeing 767-300', 'wide', 47.6], B764: ['Boeing 767-400', 'wide', 51.9], B772: ['Boeing 777-200', 'wide', 60.9],
  B77L: ['Boeing 777-200LR', 'wide', 64.8], B773: ['Boeing 777-300', 'wide', 60.9], B77W: ['Boeing 777-300ER', 'wide', 64.8],
  B778: ['Boeing 777-8', 'wide', 71.8], B779: ['Boeing 777-9', 'wide', 71.8], B788: ['Boeing 787-8', 'wide', 60.1],
  B789: ['Boeing 787-9', 'wide', 60.1], B78X: ['Boeing 787-10', 'wide', 60.1],
  E170: ['Embraer E170', 'jet', 26.0], E175: ['Embraer E175', 'jet', 26.0], E190: ['Embraer E190', 'jet', 28.7],
  E195: ['Embraer E195', 'jet', 28.7], E290: ['Embraer E190-E2', 'jet', 33.7], E295: ['Embraer E195-E2', 'jet', 35.1],
  E135: ['Embraer ERJ 135', 'jet', 20.0], E145: ['Embraer ERJ 145', 'jet', 20.0],
  CRJ2: ['Bombardier CRJ200', 'jet', 21.2], CRJ7: ['Bombardier CRJ700', 'jet', 23.2], CRJ9: ['Bombardier CRJ900', 'jet', 24.9],
  CRJX: ['Bombardier CRJ1000', 'jet', 26.2], BCS1: ['Airbus A220-100', 'jet', 35.1], BCS3: ['Airbus A220-300', 'jet', 35.1],
  F100: ['Fokker 100', 'jet', 28.1], F70: ['Fokker 70', 'jet', 28.1], MD82: ['McDonnell Douglas MD-82', 'jet', 32.9],
  MD83: ['McDonnell Douglas MD-83', 'jet', 32.9], MD11: ['McDonnell Douglas MD-11', 'wide', 51.7], RJ85: ['Avro RJ85', 'jet', 26.3],
  RJ1H: ['Avro RJ100', 'jet', 26.3], SU95: ['Sukhoi Superjet 100', 'jet', 27.8], C919: ['Comac C919', 'jet', 35.8],
  DH8A: ['Dash 8-100', 'prop', 25.9], DH8B: ['Dash 8-200', 'prop', 25.9], DH8C: ['Dash 8-300', 'prop', 27.4],
  DH8D: ['Dash 8 Q400', 'prop', 28.4], AT43: ['ATR 42-300', 'prop', 24.6], AT45: ['ATR 42-500', 'prop', 24.6],
  AT46: ['ATR 42-600', 'prop', 24.6], AT72: ['ATR 72-200', 'prop', 27.0], AT75: ['ATR 72-500', 'prop', 27.0],
  AT76: ['ATR 72-600', 'prop', 27.0], SF34: ['Saab 340', 'prop', 21.4], SB20: ['Saab 2000', 'prop', 24.8],
  E120: ['Embraer Brasilia', 'prop', 19.8], JS41: ['BAe Jetstream 41', 'prop', 18.4], D328: ['Dornier 328', 'prop', 21.0],
  F50: ['Fokker 50', 'prop', 29.0], B350: ['King Air 350', 'prop', 17.7], BE20: ['King Air 200', 'prop', 16.6],
  BE9L: ['King Air 90', 'prop', 15.3], PC12: ['Pilatus PC-12', 'prop', 16.3], C208: ['Cessna Caravan', 'prop', 15.9],
  DHC6: ['Twin Otter', 'prop', 19.8], C402: ['Cessna 402', 'prop', 13.5], F406: ['Reims-Cessna F406', 'prop', 15.1],
  PA31: ['Piper Navajo', 'prop', 12.4], P68: ['Partenavia P68', 'prop', 12.0], BE58: ['Beechcraft Baron', 'prop', 11.5],
  C172: ['Cessna 172', 'light', 11.0], C182: ['Cessna 182', 'light', 11.0], C152: ['Cessna 152', 'light', 10.2],
  C150: ['Cessna 150', 'light', 10.2], C206: ['Cessna 206', 'light', 11.0], C210: ['Cessna 210', 'light', 11.2],
  P28A: ['Piper Cherokee', 'light', 10.7], P28R: ['Piper Arrow', 'light', 10.8], PA44: ['Piper Seminole', 'light', 11.8],
  DA40: ['Diamond DA40', 'light', 11.9], DA42: ['Diamond DA42', 'light', 13.4], DA20: ['Diamond DA20', 'light', 10.9],
  SR20: ['Cirrus SR20', 'light', 11.7], SR22: ['Cirrus SR22', 'light', 11.7], BE36: ['Beechcraft Bonanza', 'light', 10.2],
  M20P: ['Mooney M20', 'light', 11.0], C77R: ['Cessna Cardinal', 'light', 10.8], SLG2: ['Slingsby T67', 'light', 10.6],
  A210: ['Aquila A210', 'light', 10.3], DV20: ['Diamond Katana', 'light', 10.9], DR40: ['Robin DR400', 'light', 8.7],
  TBM9: ['TBM 900', 'prop', 12.8], TBM7: ['TBM 700', 'prop', 12.7], PC24: ['Pilatus PC-24', 'biz', 17.0],
  C25A: ['Cessna CitationJet CJ2', 'biz', 15.2], C25B: ['Cessna Citation CJ3', 'biz', 16.3], C25C: ['Cessna Citation CJ4', 'biz', 15.5],
  C56X: ['Cessna Citation XLS', 'biz', 17.2], C680: ['Cessna Citation Sovereign', 'biz', 19.2], C68A: ['Cessna Citation Latitude', 'biz', 22.0],
  C700: ['Cessna Citation Longitude', 'biz', 21.0], C750: ['Cessna Citation X', 'biz', 19.4], CL30: ['Bombardier Challenger 300', 'biz', 19.5],
  CL35: ['Bombardier Challenger 350', 'biz', 21.0], CL60: ['Bombardier Challenger 600', 'biz', 19.6], GLF4: ['Gulfstream IV', 'biz', 23.7],
  GLF5: ['Gulfstream V', 'biz', 28.5], GLF6: ['Gulfstream G650', 'biz', 30.4], GL5T: ['Bombardier Global 5000', 'biz', 28.7],
  GLEX: ['Bombardier Global Express', 'biz', 28.7], F2TH: ['Dassault Falcon 2000', 'biz', 21.4], FA7X: ['Dassault Falcon 7X', 'biz', 26.2],
  LJ35: ['Learjet 35', 'biz', 12.0], LJ45: ['Learjet 45', 'biz', 14.6], E55P: ['Embraer Phenom 300', 'biz', 16.2],
  E50P: ['Embraer Phenom 100', 'biz', 12.3], H25B: ['Hawker 800', 'biz', 15.7], PRM1: ['Beechcraft Premier', 'biz', 13.6],
  R44: ['Robinson R44', 'heli', 10.1], R22: ['Robinson R22', 'heli', 7.7], R66: ['Robinson R66', 'heli', 10.1],
  AW139: ['AgustaWestland AW139', 'heli', 13.8], A139: ['AgustaWestland AW139', 'heli', 13.8], A109: ['AgustaWestland AW109', 'heli', 11.0],
  EC35: ['Airbus H135', 'heli', 10.2], EC45: ['Airbus H145', 'heli', 11.0], EC30: ['Airbus H130', 'heli', 10.7],
  AS50: ['Airbus H125', 'heli', 10.7], AS55: ['Eurocopter AS355', 'heli', 10.7], B06: ['Bell 206', 'heli', 10.2],
  B407: ['Bell 407', 'heli', 10.7], B412: ['Bell 412', 'heli', 14.0], B429: ['Bell 429', 'heli', 11.0],
  S76: ['Sikorsky S-76', 'heli', 13.4], S92: ['Sikorsky S-92', 'heli', 17.2], H60: ['Sikorsky Black Hawk', 'heli', 16.4],
  H64: ['Boeing AH-64 Apache', 'heli', 14.6], H47: ['Boeing CH-47 Chinook', 'heli', 18.3], NH90: ['NH90', 'heli', 16.3],
  C130: ['Lockheed C-130 Hercules', 'prop', 40.4], C17: ['Boeing C-17 Globemaster', 'wide', 51.7], K35R: ['Boeing KC-135', 'jet', 39.9],
  P8: ['Boeing P-8 Poseidon', 'jet', 37.6], E7: ['Boeing E-7 Wedgetail', 'jet', 34.3], A400: ['Airbus A400M', 'prop', 42.4],
  C30J: ['Lockheed C-130J', 'prop', 40.4], C5M: ['Lockheed C-5M Galaxy', 'wide', 67.9], K35A: ['Boeing KC-135', 'jet', 39.9],
  C560: ['Cessna Citation V', 'biz', 16.3], F18: ['F/A-18 Hornet', 'jet', 12.3], F35: ['F-35 Lightning II', 'jet', 10.7],
  F16: ['F-16 Fighting Falcon', 'jet', 9.9], EUFI: ['Eurofighter Typhoon', 'jet', 10.9], TOR: ['Panavia Tornado', 'jet', 13.9],
  HAWK: ['BAE Hawk', 'jet', 9.9], PC21: ['Pilatus PC-21', 'prop', 9.1], PC9: ['Pilatus PC-9', 'prop', 10.1],
  GLID: ['Glider', 'light', 15.0], ULAC: ['Ultralight', 'light', 9.0], BALL: ['Balloon', 'light', 0.0],
}
const CLASS_SPAN = { wide: 60.0, jet: 35.0, biz: 18.0, prop: 24.0, light: 11.0, heli: 11.0 }

// Callsign prefix → IATA code, operator. The widget's table plus the operators that cross this sky.
const AIRLINES = {
  QFA: ['QF', 'Qantas'], JST: ['JQ', 'Jetstar'], ANZ: ['NZ', 'Air New Zealand'], UAE: ['EK', 'Emirates'], ETD: ['EY', 'Etihad'],
  QTR: ['QR', 'Qatar Airways'], SIA: ['SQ', 'Singapore Airlines'], CPA: ['CX', 'Cathay Pacific'], MAS: ['MH', 'Malaysia Airlines'],
  THA: ['TG', 'Thai Airways'], CES: ['MU', 'China Eastern'], CSN: ['CZ', 'China Southern'], CCA: ['CA', 'Air China'],
  CHH: ['HU', 'Hainan Airlines'], JAL: ['JL', 'Japan Airlines'], ANA: ['NH', 'All Nippon Airways'], KAL: ['KE', 'Korean Air'],
  AAR: ['OZ', 'Asiana'], CAL: ['CI', 'China Airlines'], EVA: ['BR', 'EVA Air'], AIC: ['AI', 'Air India'], SVA: ['SV', 'Saudia'],
  THY: ['TK', 'Turkish Airlines'], BAW: ['BA', 'British Airways'], VIR: ['VS', 'Virgin Atlantic'], DLH: ['LH', 'Lufthansa'],
  CLH: ['CL', 'Lufthansa CityLine'], DLA: ['EN', 'Air Dolomiti'], GEC: ['LH', 'Lufthansa Cargo'], OCN: ['LH', 'Lufthansa City'],
  AFR: ['AF', 'Air France'], KLM: ['KL', 'KLM'], SWR: ['LX', 'Swiss'], AUA: ['OS', 'Austrian'], IBE: ['IB', 'Iberia'],
  TAP: ['TP', 'TAP Air Portugal'], AZA: ['AZ', 'ITA Airways'], ITY: ['AZ', 'ITA Airways'], SAS: ['SK', 'SAS'], FIN: ['AY', 'Finnair'],
  EIN: ['EI', 'Aer Lingus'], RYR: ['FR', 'Ryanair'], RUK: ['FR', 'Ryanair UK'], MAY: ['FR', 'Malta Air'], EZY: ['U2', 'easyJet'],
  EJU: ['EC', 'easyJet Europe'], EZS: ['DS', 'easyJet Switzerland'], WZZ: ['W6', 'Wizz Air'], WMT: ['W4', 'Wizz Air Malta'],
  WUK: ['W9', 'Wizz Air UK'], VLG: ['VY', 'Vueling'], TRA: ['HV', 'Transavia'], TVF: ['TO', 'Transavia France'],
  NAX: ['DY', 'Norwegian'], NOZ: ['DY', 'Norwegian'], NSZ: ['DY', 'Norwegian'], LOT: ['LO', 'LOT Polish Airlines'],
  AFL: ['SU', 'Aeroflot'], ELY: ['LY', 'El Al'], MSR: ['MS', 'EgyptAir'], ETH: ['ET', 'Ethiopian Airlines'],
  RAM: ['AT', 'Royal Air Maroc'], AAL: ['AA', 'American Airlines'], DAL: ['DL', 'Delta'], UAL: ['UA', 'United'],
  JBU: ['B6', 'JetBlue'], ACA: ['AC', 'Air Canada'], WJA: ['WS', 'WestJet'], FDX: ['FX', 'FedEx'], UPS: ['5X', 'UPS'],
  GTI: ['5Y', 'Atlas Air'], CLX: ['CV', 'Cargolux'], BOX: ['3S', 'AeroLogic'], BCS: ['QY', 'DHL (EAT Leipzig)'],
  DHK: ['D0', 'DHL Air UK'], ABY: ['G9', 'Air Arabia'], FDB: ['FZ', 'flydubai'], OMA: ['WY', 'Oman Air'], GFA: ['GF', 'Gulf Air'],
  KAC: ['KU', 'Kuwait Airways'], RJA: ['RJ', 'Royal Jordanian'], PIA: ['PK', 'PIA'], IGO: ['6E', 'IndiGo'],
  CFG: ['DE', 'Condor'], EWG: ['EW', 'Eurowings'], EWE: ['EW', 'Eurowings Europe'], GWI: ['4U', 'Germanwings'],
  TUI: ['X3', 'TUIfly'], TOM: ['BY', 'TUI Airways'], TFL: ['OR', 'TUI fly Netherlands'], JAF: ['TB', 'TUI fly Belgium'],
  SXS: ['XQ', 'SunExpress'], PGT: ['PC', 'Pegasus'], THT: ['TA', 'Tassili'], EXS: ['LS', 'Jet2'], VOE: ['V7', 'Volotea'],
  BEL: ['SN', 'Brussels Airlines'], AEE: ['A3', 'Aegean'], OAL: ['OA', 'Olympic Air'], CSA: ['OK', 'Czech Airlines'],
  BTI: ['BT', 'airBaltic'], ICE: ['FI', 'Icelandair'], LGL: ['LG', 'Luxair'], CTN: ['OU', 'Croatia Airlines'],
  TAR: ['TU', 'Tunisair'], NOS: ['NO', 'Neos'], EDW: ['WK', 'Edelweiss'], HFY: ['5K', 'Hi Fly'],
  ASL: ['', 'ASL Airlines'], ABR: ['', 'ASL Airlines Ireland'], SRR: ['', 'Star Air'], QAC: ['QR', 'Qatar Airways Cargo'],
  CKS: ['K4', 'Kalitta Air'], SQC: ['SQ', 'Singapore Airlines Cargo'], MPH: ['MP', 'Martinair'], AUI: ['PS', 'Ukraine Intl'],
  CHX: ['', 'ADAC Luftrettung'], DRF: ['', 'DRF Luftrettung'], JOK: ['', 'Johanniter Luftrettung'], BPO: ['', 'Bundespolizei'],
  HUMMEL: ['', 'Polizei'], GAF: ['', 'German Air Force'], GAM: ['', 'German Army'], GNY: ['', 'German Navy'],
  RCH: ['', 'US Air Force'], RRR: ['', 'Royal Air Force'], CFC: ['', 'Royal Canadian Air Force'], FAF: ['', 'French Air Force'],
  BAF: ['', 'Belgian Air Force'], NAF: ['', 'Royal Netherlands Air Force'], AME: ['', 'Spanish Air Force'],
  IAM: ['', 'Italian Air Force'], PLF: ['', 'Polish Air Force'], NATO: ['', 'NATO'], DUKE: ['', 'US Army'],
  EVAC: ['', 'US Air Force (aeromedical)'], SAM: ['', 'US Air Force (Special Air Mission)'], REACH: ['', 'US Air Force'],
  VVLL: ['', 'US Navy'], ASY: ['', 'Royal Australian Air Force'],
  FSW: ['', 'Flight School'], EFD: ['', 'E-Aviation'], LXJ: ['', 'Flexjet'], NJE: ['', 'NetJets Europe'], VJT: ['', 'VistaJet'],
  AZE: ['', 'Arcus Air'], GLJ: ['', 'GlobeAir'], SXT: ['', 'Sixt Aviation'], DCS: ['', 'DC Aviation'], ATF: ['', 'Atlas Air Service'],
}

const CATEGORY_CLASS = { A1: 'light', A2: 'prop', A5: 'wide', A7: 'heli' }
const HELI_PREFIXES = ['R4', 'R2', 'EC', 'AS', 'B4', 'A10', 'A13', 'H6', 'H4', 'NH9']
const LIGHT_PREFIXES = ['C1', 'P2', 'DA', 'SR', 'DR', 'DV']

const typeOf = (code, desc, category) => {
  code = (code || '').trim().toUpperCase()
  if (TYPES[code])
    return TYPES[code]
  const words = (desc || '').replace(/\s+/g, ' ').trim()
  const name = words ? titleCase(words).replace('Airbus Industrie', 'Airbus') : (code || 'Aircraft')
  const cat = (category || '').toUpperCase()
  const cls = cat === 'A7' || words.toUpperCase().includes('HELI') || HELI_PREFIXES.some(p => code.startsWith(p)) ? 'heli'
    : cat === 'A1' || LIGHT_PREFIXES.some(p => code.startsWith(p)) ? 'light'
      : CATEGORY_CLASS[cat] || 'jet'
  return [name, cls, CLASS_SPAN[cls]]
}

const titleCase = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

const airlineOf = (cs, reg) => {
  for (const n of [6, 5, 4, 3]) {
    const prefix = cs.slice(0, n)
    if (AIRLINES[prefix] && cs.length > n && /^[A-Z0-9]+$/.test(cs.slice(n)))
      return AIRLINES[prefix]
  }
  if (cs && reg && cs.replace(/-/g, '') === reg.replace(/-/g, ''))
    return ['', 'private']
  return ['', '']
}

const bearing = (lat1, lon1, lat2, lon2) => {
  const rad = d => d * Math.PI / 180
  const p1 = rad(lat1)
  const p2 = rad(lat2)
  const dl = rad(lon2 - lon1)
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  const km = 6371 * 2 * Math.asin(Math.sqrt(a))
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  return [km, (Math.atan2(y, x) * 180 / Math.PI + 360) % 360]
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const compassOf = deg => COMPASS[Math.round(deg / 45) % 8]
const DIRECTION = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' }

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const rowOf = (a, home, radiusKm, includeGround) => {
  const alat = num(a.lat)
  const alon = num(a.lon)
  if (alat === null || alon === null)
    return null
  const [km, deg] = bearing(home.lat, home.lon, alat, alon)
  if (km > radiusKm)
    return null
  const altRaw = a.alt_baro !== undefined ? a.alt_baro : a.alt_geom
  const alt = altRaw === 'ground' ? 0 : Math.max(0, Math.round(num(altRaw) || 0))
  const ground = altRaw === 'ground' || alt <= 25
  if (ground && !includeGround)
    return null
  const rate = Math.round(num(a.baro_rate) ?? num(a.geom_rate) ?? 0)
  const cs = String(a.flight || '').trim().toUpperCase()
  const reg = String(a.r || '').trim().toUpperCase()
  const code = String(a.t || '').trim().toUpperCase()
  const [typ, cls, span] = typeOf(code, a.desc, a.category)
  const [iata, airlineName] = airlineOf(cs, reg)
  const gs = Math.round(num(a.gs) || 0)
  const trk = Math.round(num(a.track) ?? num(a.true_heading) ?? num(a.mag_heading) ?? 0)
  const military = typeof a.dbFlags === 'number' && (a.dbFlags & 1) === 1
  const compass = compassOf(deg)
  return {
    hex: String(a.hex || ''),
    cs: cs || reg || String(a.hex || '').toUpperCase(),
    reg,
    code,
    typ,
    cls,
    span,
    alt,
    altText: ground ? 'on the ground' : `${alt.toLocaleString('en-US')} ft`,
    ground,
    rate,
    trend: ground ? 'on the ground' : rate > 250 ? 'climbing' : rate < -250 ? 'descending' : 'level',
    gs,
    trk,
    heading: String(trk).padStart(3, '0'),
    km: Math.round(km * 10) / 10,
    dir: Math.round(deg),
    compass,
    direction: DIRECTION[compass],
    where: `${Math.round(km * 10) / 10} km ${DIRECTION[compass]}`,
    military,
    airline: airlineName,
    iata,
    squawk: String(a.squawk || ''),
    route: null,
    photo: null,
  }
}

const aircraftOf = (ac, settings) => {
  const rows = []
  for (const a of ac) {
    if (a && typeof a === 'object') {
      const row = rowOf(a, settings.home, settings.radiusKm, settings.includeGround)
      if (row)
        rows.push(row)
    }
  }
  rows.sort((x, y) => x.km - y.km)
  return rows
}

const clockOf = (date, timeZone) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(date)
  }
  catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(date)
  }
}

const page = (ac, feed, settings) => {
  const rows = aircraftOf(ac, settings)
  const now = new Date()
  return {
    ok: true,
    feed,
    place: settings.place,
    radiusKm: settings.radiusKm,
    count: rows.length,
    aircraft: rows.slice(0, SHOW),
    at: now.toISOString(),
    clock: clockOf(now, settings.timeZone),
  }
}

const withinTimeout = (ms) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, done: () => clearTimeout(timer) }
}

const getJson = async (url) => {
  const { signal, done } = withinTimeout(LOOKUP_MS)
  try {
    const response = await fetch(url, { headers: { 'User-Agent': CONTACT, 'Accept': 'application/json' }, signal })
    if (!response.ok)
      return { status: response.status }
    return { status: response.status, body: await response.json() }
  }
  finally {
    done()
  }
}

const photoFrom = (body) => {
  const p = body && Array.isArray(body.photos) ? body.photos[0] : null
  if (!p || !p.thumbnail_large || !p.thumbnail_large.src)
    return {}
  return { s: String(p.thumbnail_large.src), b: String(p.photographer || '') }
}

const routeFrom = (body) => {
  const fr = body && body.response && body.response.flightroute
  if (!fr || !fr.origin || !fr.destination)
    return {}
  return {
    o: String(fr.origin.iata_code || ''),
    oc: String(fr.origin.municipality || ''),
    d: String(fr.destination.iata_code || ''),
    dc: String(fr.destination.municipality || ''),
    a: String((fr.airline && fr.airline.name) || ''),
  }
}

const routeWorthAsking = cs => /^[A-Z]{3}[A-Z0-9]*\d[A-Z0-9]*$/.test(cs)

// A lookup that answered (even "none") is remembered; one that failed is asked again next run.
const lookup = async (cache, key, url, pick) => {
  if (Object.prototype.hasOwnProperty.call(cache, key))
    return cache[key]
  try {
    const { status, body } = await getJson(url)
    if (status === 200 || status === 404) {
      cache[key] = { ...pick(body), t: Date.now() }
      return cache[key]
    }
  }
  catch {}
  return null
}

const trimmed = (cache, keep) => {
  const entries = Object.entries(cache).sort((a, b) => (b[1].t || 0) - (a[1].t || 0)).slice(0, keep)
  return Object.fromEntries(entries)
}

const fitState = (state) => {
  while (JSON.stringify(state).length > STATE_BYTES && (Object.keys(state.photos).length > 2 || Object.keys(state.routes).length > 2)) {
    state.photos = trimmed(state.photos, Math.max(2, Math.floor(Object.keys(state.photos).length * 0.7)))
    state.routes = trimmed(state.routes, Math.max(2, Math.floor(Object.keys(state.routes).length * 0.7)))
  }
  return state
}

const enrich = async (result, saved, timeZone) => {
  const state = {
    photos: saved && saved.photos && typeof saved.photos === 'object' ? { ...saved.photos } : {},
    routes: saved && saved.routes && typeof saved.routes === 'object' ? { ...saved.routes } : {},
    last: saved && saved.last ? saved.last : null,
  }
  const asks = []
  for (const a of result.aircraft) {
    if (a.reg)
      asks.push(lookup(state.photos, a.reg, PHOTO_URL + encodeURIComponent(a.reg), photoFrom).then((p) => {
        if (p && p.s)
          a.photo = { src: p.s, thumb: p.s.replace(/_280\.jpg$/, '_t.jpg'), by: p.b }
      }))
    if (routeWorthAsking(a.cs))
      asks.push(lookup(state.routes, a.cs, ROUTE_URL + encodeURIComponent(a.cs), routeFrom).then((r) => {
        if (r && r.o && r.d)
          a.route = { origin: r.o, originCity: r.oc, dest: r.d, destCity: r.dc }
        if (r && r.a && !a.airline)
          a.airline = r.a
      }))
  }
  await Promise.allSettled(asks)
  state.photos = trimmed(state.photos, KEEP_PHOTOS)
  state.routes = trimmed(state.routes, KEEP_ROUTES)
  if (result.aircraft.length > 0) {
    const hero = result.aircraft[0]
    state.last = { cs: hero.cs, typ: hero.typ, airline: hero.airline, at: result.at }
  }
  result.lastSeen = state.last && result.aircraft.length === 0 ? { ...state.last, clock: clockOf(new Date(state.last.at), timeZone) } : null
  result.enriched = true
  return { sky: result, trmnl_state: fitState(state) }
}

// The Form Fields, with the defaults a hand-built Plugin without them gets.
const settingsOf = (input) => {
  const trmnl = input.trmnl && typeof input.trmnl === 'object' ? input.trmnl : {}
  const fields = (trmnl.plugin_settings && trmnl.plugin_settings.custom_fields_values) || {}
  const [lat, lon] = String(fields.location || '').split(',').map(s => Number.parseFloat(s))
  const radius = Number.parseFloat(fields.radius_km)
  return {
    home: Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null,
    radiusKm: Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_RADIUS_KM,
    place: String(fields.place || '').trim() || 'Home',
    includeGround: ['yes', 'true', '1'].includes(String(fields.show_ground || '').toLowerCase()),
    timeZone: (trmnl.user && trmnl.user.time_zone_iana) || 'UTC',
  }
}

const run = (input) => {
  const source = input && typeof input === 'object' ? input : {}
  const settings = settingsOf(source)
  if (!settings.home)
    return { sky: { error: true, message: 'Set your location in the plugin settings.', place: settings.place, radiusKm: settings.radiusKm, clock: clockOf(new Date(), settings.timeZone) } }
  const ac = Array.isArray(source.ac) ? source.ac : (source.data && Array.isArray(source.data.ac) ? source.data.ac : [])
  const result = page(ac, 'adsb.lol', settings)
  if (typeof fetch !== 'function')
    return { sky: result }
  return enrich(result, source.trmnl && source.trmnl.state, settings.timeZone)
}

module.exports = { run }
