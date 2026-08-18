/* Apex Football Simulator - Fixed (no external fetch) */
const App = (() => {
  // ========== EMBEDDED TEAMS DATA ==========
  const TEAMS_DATA = 
{
  "national": [
    {
      "id": "bra",
      "name": "Brazil",
      "short": "BRA",
      "flag": "🇧🇷",
      "color": "#009c3b",
      "secondary": "#ffdf00",
      "players": [
        {"id": "bra1", "name": "Alisson", "pos": ["GK"], "ovr": 89, "att": 20, "def": 88, "phy": 85, "pac": 60, "tec": 70},
        {"id": "bra2", "name": "Ederson", "pos": ["GK"], "ovr": 88, "att": 25, "def": 86, "phy": 84, "pac": 65, "tec": 75},
        {"id": "bra3", "name": "Marquinhos", "pos": ["CB"], "ovr": 87, "att": 50, "def": 90, "phy": 85, "pac": 78, "tec": 75},
        {"id": "bra4", "name": "Thiago Silva", "pos": ["CB"], "ovr": 84, "att": 45, "def": 88, "phy": 80, "pac": 60, "tec": 78},
        {"id": "bra5", "name": "Militão", "pos": ["CB", "RB"], "ovr": 86, "att": 55, "def": 87, "phy": 86, "pac": 85, "tec": 72},
        {"id": "bra6", "name": "Bremer", "pos": ["CB"], "ovr": 85, "att": 48, "def": 86, "phy": 88, "pac": 78, "tec": 70},
        {"id": "bra7", "name": "Danilo", "pos": ["RB", "CB"], "ovr": 82, "att": 60, "def": 82, "phy": 80, "pac": 75, "tec": 78},
        {"id": "bra8", "name": "Alex Sandro", "pos": ["LB"], "ovr": 81, "att": 65, "def": 80, "phy": 78, "pac": 80, "tec": 80},
        {"id": "bra9", "name": "Carlos Augusto", "pos": ["LB", "LM"], "ovr": 80, "att": 68, "def": 78, "phy": 76, "pac": 82, "tec": 78},
        {"id": "bra10", "name": "Casemiro", "pos": ["CDM", "CM"], "ovr": 87, "att": 70, "def": 88, "phy": 88, "pac": 65, "tec": 80},
        {"id": "bra11", "name": "Bruno Guimarães", "pos": ["CM", "CDM"], "ovr": 85, "att": 75, "def": 80, "phy": 82, "pac": 75, "tec": 85},
        {"id": "bra12", "name": "André", "pos": ["CDM", "CM"], "ovr": 82, "att": 65, "def": 83, "phy": 80, "pac": 78, "tec": 80},
        {"id": "bra13", "name": "Paquetá", "pos": ["CM", "CAM"], "ovr": 84, "att": 82, "def": 70, "phy": 78, "pac": 78, "tec": 88},
        {"id": "bra14", "name": "Joelinton", "pos": ["CM", "LW", "ST"], "ovr": 83, "att": 80, "def": 75, "phy": 88, "pac": 80, "tec": 78},
        {"id": "bra15", "name": "Rodrygo", "pos": ["RW", "ST", "LW"], "ovr": 86, "att": 88, "def": 40, "phy": 70, "pac": 90, "tec": 88},
        {"id": "bra16", "name": "Vinícius Jr", "pos": ["LW", "ST"], "ovr": 90, "att": 92, "def": 35, "phy": 75, "pac": 95, "tec": 90},
        {"id": "bra17", "name": "Raphinha", "pos": ["RW", "LW"], "ovr": 84, "att": 85, "def": 45, "phy": 72, "pac": 88, "tec": 85},
        {"id": "bra18", "name": "Endrick", "pos": ["ST", "RW"], "ovr": 81, "att": 84, "def": 30, "phy": 78, "pac": 88, "tec": 80},
        {"id": "bra19", "name": "Richarlison", "pos": ["ST", "LW"], "ovr": 82, "att": 85, "def": 40, "phy": 85, "pac": 82, "tec": 78},
        {"id": "bra20", "name": "Gabriel Jesus", "pos": ["ST", "RW"], "ovr": 82, "att": 84, "def": 45, "phy": 78, "pac": 85, "tec": 84},
        {"id": "bra21", "name": "Neymar", "pos": ["LW", "CAM", "ST"], "ovr": 87, "att": 90, "def": 35, "phy": 70, "pac": 85, "tec": 94},
        {"id": "bra22", "name": "Martinelli", "pos": ["LW", "RW"], "ovr": 83, "att": 84, "def": 40, "phy": 72, "pac": 90, "tec": 82},
        {"id": "bra23", "name": "Douglas Luiz", "pos": ["CM", "CDM"], "ovr": 81, "att": 72, "def": 78, "phy": 78, "pac": 75, "tec": 82},
        {"id": "bra24", "name": "Savinho", "pos": ["RW", "LW"], "ovr": 80, "att": 82, "def": 35, "phy": 68, "pac": 90, "tec": 84},
        {"id": "bra25", "name": "Andreas Pereira", "pos": ["CAM", "CM"], "ovr": 79, "att": 78, "def": 55, "phy": 70, "pac": 78, "tec": 82},
        {"id": "bra26", "name": "Weverton", "pos": ["GK"], "ovr": 80, "att": 15, "def": 80, "phy": 78, "pac": 55, "tec": 65},
        {"id": "bra27", "name": "Beraldo", "pos": ["CB"], "ovr": 78, "att": 40, "def": 80, "phy": 78, "pac": 75, "tec": 70},
        {"id": "bra28", "name": "Yan Couto", "pos": ["RB", "RW"], "ovr": 79, "att": 70, "def": 72, "phy": 70, "pac": 88, "tec": 78}
      ]
    },
    {
      "id": "arg",
      "name": "Argentina",
      "short": "ARG",
      "flag": "🇦🇷",
      "color": "#75aadb",
      "secondary": "#ffffff",
      "players": [
        {"id": "arg1", "name": "Emiliano Martínez", "pos": ["GK"], "ovr": 88, "att": 20, "def": 87, "phy": 85, "pac": 55, "tec": 70},
        {"id": "arg2", "name": "Armani", "pos": ["GK"], "ovr": 80, "att": 15, "def": 80, "phy": 78, "pac": 50, "tec": 65},
        {"id": "arg3", "name": "Cuti Romero", "pos": ["CB"], "ovr": 86, "att": 50, "def": 88, "phy": 86, "pac": 80, "tec": 70},
        {"id": "arg4", "name": "Lisandro Martínez", "pos": ["CB", "LB"], "ovr": 85, "att": 55, "def": 87, "phy": 82, "pac": 75, "tec": 78},
        {"id": "arg5", "name": "Otamendi", "pos": ["CB"], "ovr": 82, "att": 45, "def": 85, "phy": 82, "pac": 60, "tec": 72},
        {"id": "arg6", "name": "Molina", "pos": ["RB"], "ovr": 83, "att": 70, "def": 80, "phy": 78, "pac": 85, "tec": 78},
        {"id": "arg7", "name": "Tagliafico", "pos": ["LB"], "ovr": 81, "att": 65, "def": 80, "phy": 78, "pac": 80, "tec": 75},
        {"id": "arg8", "name": "Acuña", "pos": ["LB", "LM"], "ovr": 82, "att": 72, "def": 78, "phy": 80, "pac": 82, "tec": 80},
        {"id": "arg9", "name": "De Paul", "pos": ["CM", "RM"], "ovr": 85, "att": 80, "def": 75, "phy": 82, "pac": 78, "tec": 85},
        {"id": "arg10", "name": "Mac Allister", "pos": ["CM", "CAM"], "ovr": 84, "att": 80, "def": 72, "phy": 78, "pac": 75, "tec": 86},
        {"id": "arg11", "name": "Enzo Fernández", "pos": ["CM", "CDM"], "ovr": 84, "att": 78, "def": 78, "phy": 80, "pac": 75, "tec": 85},
        {"id": "arg12", "name": "Paredes", "pos": ["CDM", "CM"], "ovr": 81, "att": 70, "def": 82, "phy": 78, "pac": 65, "tec": 82},
        {"id": "arg13", "name": "Lo Celso", "pos": ["CAM", "CM"], "ovr": 81, "att": 80, "def": 55, "phy": 70, "pac": 78, "tec": 85},
        {"id": "arg14", "name": "Messi", "pos": ["RW", "CAM", "ST"], "ovr": 90, "att": 92, "def": 35, "phy": 68, "pac": 82, "tec": 95},
        {"id": "arg15", "name": "Álvarez", "pos": ["ST", "LW"], "ovr": 85, "att": 88, "def": 40, "phy": 78, "pac": 88, "tec": 84},
        {"id": "arg16", "name": "Lautaro", "pos": ["ST"], "ovr": 87, "att": 90, "def": 35, "phy": 82, "pac": 82, "tec": 85},
        {"id": "arg17", "name": "Di María", "pos": ["RW", "LW", "CAM"], "ovr": 84, "att": 85, "def": 40, "phy": 70, "pac": 82, "tec": 88},
        {"id": "arg18", "name": "Dybala", "pos": ["CAM", "ST", "RW"], "ovr": 85, "att": 88, "def": 35, "phy": 68, "pac": 80, "tec": 90},
        {"id": "arg19", "name": "Garnacho", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 90, "tec": 80},
        {"id": "arg20", "name": "Thiago Almada", "pos": ["CAM", "LW"], "ovr": 80, "att": 82, "def": 40, "phy": 68, "pac": 85, "tec": 84},
        {"id": "arg21", "name": "Palacios", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 78, "phy": 78, "pac": 78, "tec": 80},
        {"id": "arg22", "name": "Montiel", "pos": ["RB"], "ovr": 79, "att": 65, "def": 78, "phy": 80, "pac": 82, "tec": 72},
        {"id": "arg23", "name": "Pezzella", "pos": ["CB"], "ovr": 78, "att": 40, "def": 80, "phy": 80, "pac": 60, "tec": 68},
        {"id": "arg24", "name": "Rulli", "pos": ["GK"], "ovr": 79, "att": 18, "def": 79, "phy": 78, "pac": 55, "tec": 68},
        {"id": "arg25", "name": "Gonzalo Montiel", "pos": ["RB"], "ovr": 78, "att": 62, "def": 76, "phy": 78, "pac": 80, "tec": 72}
      ]
    },
    {
      "id": "fra",
      "name": "France",
      "short": "FRA",
      "flag": "🇫🇷",
      "color": "#002654",
      "secondary": "#ed2939",
      "players": [
        {"id": "fra1", "name": "Lloris", "pos": ["GK"], "ovr": 84, "att": 15, "def": 84, "phy": 80, "pac": 50, "tec": 70},
        {"id": "fra2", "name": "Maignan", "pos": ["GK"], "ovr": 87, "att": 25, "def": 86, "phy": 84, "pac": 60, "tec": 75},
        {"id": "fra3", "name": "Upamecano", "pos": ["CB"], "ovr": 84, "att": 50, "def": 85, "phy": 88, "pac": 82, "tec": 70},
        {"id": "fra4", "name": "Saliba", "pos": ["CB"], "ovr": 87, "att": 45, "def": 88, "phy": 85, "pac": 80, "tec": 75},
        {"id": "fra5", "name": "Konaté", "pos": ["CB"], "ovr": 84, "att": 48, "def": 85, "phy": 88, "pac": 80, "tec": 70},
        {"id": "fra6", "name": "Hernández", "pos": ["LB"], "ovr": 85, "att": 75, "def": 82, "phy": 80, "pac": 88, "tec": 80},
        {"id": "fra7", "name": "Koundé", "pos": ["RB", "CB"], "ovr": 85, "att": 65, "def": 85, "phy": 82, "pac": 85, "tec": 78},
        {"id": "fra8", "name": "Tchouaméni", "pos": ["CDM", "CM"], "ovr": 85, "att": 70, "def": 85, "phy": 86, "pac": 75, "tec": 80},
        {"id": "fra9", "name": "Camavinga", "pos": ["CM", "LB", "CDM"], "ovr": 84, "att": 72, "def": 80, "phy": 82, "pac": 85, "tec": 82},
        {"id": "fra10", "name": "Rabiot", "pos": ["CM", "LM"], "ovr": 83, "att": 78, "def": 78, "phy": 85, "pac": 75, "tec": 80},
        {"id": "fra11", "name": "Griezmann", "pos": ["CAM", "ST", "RW"], "ovr": 87, "att": 88, "def": 55, "phy": 75, "pac": 80, "tec": 90},
        {"id": "fra12", "name": "Mbappé", "pos": ["ST", "LW"], "ovr": 91, "att": 93, "def": 35, "phy": 80, "pac": 97, "tec": 88},
        {"id": "fra13", "name": "Dembélé", "pos": ["RW", "LW"], "ovr": 85, "att": 86, "def": 35, "phy": 70, "pac": 92, "tec": 88},
        {"id": "fra14", "name": "Coman", "pos": ["LW", "RW"], "ovr": 84, "att": 85, "def": 35, "phy": 72, "pac": 92, "tec": 85},
        {"id": "fra15", "name": "Giroud", "pos": ["ST"], "ovr": 82, "att": 85, "def": 40, "phy": 82, "pac": 60, "tec": 80},
        {"id": "fra16", "name": "Thuram", "pos": ["ST", "RW"], "ovr": 84, "att": 86, "def": 40, "phy": 85, "pac": 88, "tec": 80},
        {"id": "fra17", "name": "Fofana", "pos": ["CM", "CDM"], "ovr": 81, "att": 70, "def": 80, "phy": 82, "pac": 80, "tec": 78},
        {"id": "fra18", "name": "Zaire-Emery", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 75, "phy": 75, "pac": 82, "tec": 82},
        {"id": "fra19", "name": "Barcola", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 90, "tec": 82},
        {"id": "fra20", "name": "Pavard", "pos": ["RB", "CB"], "ovr": 81, "att": 60, "def": 82, "phy": 80, "pac": 75, "tec": 75},
        {"id": "fra21", "name": "Clauss", "pos": ["RB", "RM"], "ovr": 80, "att": 72, "def": 75, "phy": 75, "pac": 85, "tec": 78},
        {"id": "fra22", "name": "Areola", "pos": ["GK"], "ovr": 81, "att": 18, "def": 81, "phy": 78, "pac": 55, "tec": 68},
        {"id": "fra23", "name": "Disasi", "pos": ["CB"], "ovr": 79, "att": 45, "def": 80, "phy": 85, "pac": 72, "tec": 68},
        {"id": "fra24", "name": "Guendouzi", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 75, "phy": 80, "pac": 78, "tec": 80},
        {"id": "fra25", "name": "Kolo Muani", "pos": ["ST", "RW"], "ovr": 81, "att": 83, "def": 35, "phy": 80, "pac": 88, "tec": 78}
      ]
    },
    {
      "id": "eng",
      "name": "England",
      "short": "ENG",
      "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      "color": "#ffffff",
      "secondary": "#cf081f",
      "players": [
        {"id": "eng1", "name": "Pickford", "pos": ["GK"], "ovr": 83, "att": 20, "def": 83, "phy": 80, "pac": 55, "tec": 70},
        {"id": "eng2", "name": "Ramsdale", "pos": ["GK"], "ovr": 81, "att": 18, "def": 81, "phy": 78, "pac": 55, "tec": 68},
        {"id": "eng3", "name": "Stones", "pos": ["CB"], "ovr": 85, "att": 55, "def": 86, "phy": 82, "pac": 72, "tec": 80},
        {"id": "eng4", "name": "Walker", "pos": ["RB", "CB"], "ovr": 84, "att": 60, "def": 82, "phy": 80, "pac": 90, "tec": 75},
        {"id": "eng5", "name": "Guehi", "pos": ["CB"], "ovr": 82, "att": 45, "def": 84, "phy": 82, "pac": 75, "tec": 72},
        {"id": "eng6", "name": "Dunk", "pos": ["CB"], "ovr": 80, "att": 40, "def": 82, "phy": 82, "pac": 55, "tec": 68},
        {"id": "eng7", "name": "Shaw", "pos": ["LB"], "ovr": 82, "att": 70, "def": 80, "phy": 78, "pac": 80, "tec": 80},
        {"id": "eng8", "name": "Trippier", "pos": ["RB", "RM"], "ovr": 83, "att": 75, "def": 80, "phy": 75, "pac": 75, "tec": 85},
        {"id": "eng9", "name": "Rice", "pos": ["CDM", "CM"], "ovr": 87, "att": 70, "def": 88, "phy": 88, "pac": 75, "tec": 80},
        {"id": "eng10", "name": "Bellingham", "pos": ["CM", "CAM"], "ovr": 88, "att": 85, "def": 75, "phy": 85, "pac": 82, "tec": 88},
        {"id": "eng11", "name": "Foden", "pos": ["CAM", "RW", "LW"], "ovr": 87, "att": 88, "def": 50, "phy": 72, "pac": 85, "tec": 90},
        {"id": "eng12", "name": "Saka", "pos": ["RW", "RM"], "ovr": 87, "att": 88, "def": 50, "phy": 75, "pac": 90, "tec": 88},
        {"id": "eng13", "name": "Kane", "pos": ["ST"], "ovr": 89, "att": 92, "def": 45, "phy": 82, "pac": 70, "tec": 88},
        {"id": "eng14", "name": "Rashford", "pos": ["LW", "ST"], "ovr": 84, "att": 86, "def": 35, "phy": 78, "pac": 90, "tec": 82},
        {"id": "eng15", "name": "Grealish", "pos": ["LW", "CAM"], "ovr": 83, "att": 84, "def": 45, "phy": 72, "pac": 78, "tec": 88},
        {"id": "eng16", "name": "Palmer", "pos": ["CAM", "RW"], "ovr": 84, "att": 86, "def": 40, "phy": 70, "pac": 82, "tec": 88},
        {"id": "eng17", "name": "Gordon", "pos": ["LW", "RW"], "ovr": 82, "att": 84, "def": 40, "phy": 75, "pac": 88, "tec": 80},
        {"id": "eng18", "name": "Gallagher", "pos": ["CM"], "ovr": 80, "att": 75, "def": 75, "phy": 82, "pac": 80, "tec": 78},
        {"id": "eng19", "name": "Mainoo", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 75, "phy": 78, "pac": 80, "tec": 82},
        {"id": "eng20", "name": "Alexander-Arnold", "pos": ["RB", "CM"], "ovr": 86, "att": 80, "def": 78, "phy": 75, "pac": 80, "tec": 90},
        {"id": "eng21", "name": "Maguire", "pos": ["CB"], "ovr": 80, "att": 50, "def": 82, "phy": 85, "pac": 50, "tec": 70},
        {"id": "eng22", "name": "Pope", "pos": ["GK"], "ovr": 82, "att": 15, "def": 82, "phy": 80, "pac": 50, "tec": 68},
        {"id": "eng23", "name": "Eze", "pos": ["CAM", "LW"], "ovr": 82, "att": 84, "def": 45, "phy": 72, "pac": 82, "tec": 86},
        {"id": "eng24", "name": "Watkins", "pos": ["ST"], "ovr": 83, "att": 85, "def": 35, "phy": 82, "pac": 85, "tec": 78},
        {"id": "eng25", "name": "Toney", "pos": ["ST"], "ovr": 81, "att": 84, "def": 40, "phy": 82, "pac": 75, "tec": 78}
      ]
    },
    {
      "id": "ger",
      "name": "Germany",
      "short": "GER",
      "flag": "🇩🇪",
      "color": "#000000",
      "secondary": "#dd0000",
      "players": [
        {"id": "ger1", "name": "Neuer", "pos": ["GK"], "ovr": 86, "att": 30, "def": 85, "phy": 82, "pac": 55, "tec": 80},
        {"id": "ger2", "name": "ter Stegen", "pos": ["GK"], "ovr": 88, "att": 25, "def": 87, "phy": 82, "pac": 55, "tec": 78},
        {"id": "ger3", "name": "Rüdiger", "pos": ["CB"], "ovr": 86, "att": 50, "def": 87, "phy": 90, "pac": 80, "tec": 70},
        {"id": "ger4", "name": "Tah", "pos": ["CB"], "ovr": 84, "att": 45, "def": 85, "phy": 88, "pac": 70, "tec": 72},
        {"id": "ger5", "name": "Schlotterbeck", "pos": ["CB"], "ovr": 83, "att": 55, "def": 84, "phy": 85, "pac": 80, "tec": 75},
        {"id": "ger6", "name": "Raum", "pos": ["LB"], "ovr": 82, "att": 75, "def": 78, "phy": 78, "pac": 88, "tec": 80},
        {"id": "ger7", "name": "Kimmich", "pos": ["CDM", "RB", "CM"], "ovr": 87, "att": 78, "def": 85, "phy": 80, "pac": 75, "tec": 88},
        {"id": "ger8", "name": "Goretzka", "pos": ["CM", "CDM"], "ovr": 85, "att": 80, "def": 80, "phy": 88, "pac": 78, "tec": 82},
        {"id": "ger9", "name": "Musiala", "pos": ["CAM", "CM", "LW"], "ovr": 87, "att": 88, "def": 50, "phy": 72, "pac": 85, "tec": 92},
        {"id": "ger10", "name": "Wirtz", "pos": ["CAM", "CM"], "ovr": 88, "att": 88, "def": 45, "phy": 70, "pac": 85, "tec": 92},
        {"id": "ger11", "name": "Sané", "pos": ["RW", "LW"], "ovr": 84, "att": 85, "def": 35, "phy": 72, "pac": 92, "tec": 85},
        {"id": "ger12", "name": "Gnabry", "pos": ["RW", "ST"], "ovr": 83, "att": 84, "def": 40, "phy": 75, "pac": 85, "tec": 84},
        {"id": "ger13", "name": "Havertz", "pos": ["ST", "CAM", "CM"], "ovr": 84, "att": 85, "def": 55, "phy": 80, "pac": 80, "tec": 84},
        {"id": "ger14", "name": "Füllkrug", "pos": ["ST"], "ovr": 82, "att": 84, "def": 40, "phy": 85, "pac": 65, "tec": 78},
        {"id": "ger15", "name": "Müller", "pos": ["CAM", "ST", "RW"], "ovr": 83, "att": 85, "def": 50, "phy": 72, "pac": 70, "tec": 88},
        {"id": "ger16", "name": "Gündoğan", "pos": ["CM", "CAM"], "ovr": 84, "att": 82, "def": 70, "phy": 75, "pac": 70, "tec": 88},
        {"id": "ger17", "name": "Andrich", "pos": ["CDM", "CM"], "ovr": 81, "att": 70, "def": 82, "phy": 85, "pac": 70, "tec": 75},
        {"id": "ger18", "name": "Mittelstädt", "pos": ["LB"], "ovr": 80, "att": 68, "def": 78, "phy": 78, "pac": 82, "tec": 75},
        {"id": "ger19", "name": "Henrichs", "pos": ["RB", "RM"], "ovr": 80, "att": 70, "def": 78, "phy": 78, "pac": 82, "tec": 78},
        {"id": "ger20", "name": "Beier", "pos": ["ST", "RW"], "ovr": 79, "att": 82, "def": 35, "phy": 75, "pac": 85, "tec": 78},
        {"id": "ger21", "name": "Nübel", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68},
        {"id": "ger22", "name": "Koch", "pos": ["CB"], "ovr": 79, "att": 45, "def": 80, "phy": 82, "pac": 70, "tec": 70},
        {"id": "ger23", "name": "Groß", "pos": ["CM", "CDM"], "ovr": 80, "att": 75, "def": 75, "phy": 75, "pac": 70, "tec": 82},
        {"id": "ger24", "name": "Undav", "pos": ["ST"], "ovr": 80, "att": 82, "def": 35, "phy": 80, "pac": 78, "tec": 78},
        {"id": "ger25", "name": "Adeyemi", "pos": ["LW", "RW"], "ovr": 81, "att": 82, "def": 35, "phy": 75, "pac": 95, "tec": 78}
      ]
    },
    {
      "id": "esp",
      "name": "Spain",
      "short": "ESP",
      "flag": "🇪🇸",
      "color": "#aa151b",
      "secondary": "#f1bf00",
      "players": [
        {"id": "esp1", "name": "Unai Simón", "pos": ["GK"], "ovr": 84, "att": 18, "def": 84, "phy": 80, "pac": 55, "tec": 70},
        {"id": "esp2", "name": "Raya", "pos": ["GK"], "ovr": 83, "att": 20, "def": 83, "phy": 78, "pac": 55, "tec": 72},
        {"id": "esp3", "name": "Carvajal", "pos": ["RB"], "ovr": 85, "att": 70, "def": 84, "phy": 80, "pac": 80, "tec": 82},
        {"id": "esp4", "name": "Le Normand", "pos": ["CB"], "ovr": 82, "att": 40, "def": 84, "phy": 82, "pac": 70, "tec": 70},
        {"id": "esp5", "name": "Laporte", "pos": ["CB"], "ovr": 84, "att": 50, "def": 85, "phy": 82, "pac": 70, "tec": 78},
        {"id": "esp6", "name": "Cubarsí", "pos": ["CB"], "ovr": 80, "att": 45, "def": 82, "phy": 75, "pac": 75, "tec": 78},
        {"id": "esp7", "name": "Balde", "pos": ["LB"], "ovr": 83, "att": 72, "def": 78, "phy": 75, "pac": 92, "tec": 80},
        {"id": "esp8", "name": "Rodri", "pos": ["CDM", "CM"], "ovr": 90, "att": 75, "def": 90, "phy": 85, "pac": 70, "tec": 88},
        {"id": "esp9", "name": "Pedri", "pos": ["CM", "CAM"], "ovr": 86, "att": 80, "def": 70, "phy": 70, "pac": 80, "tec": 92},
        {"id": "esp10", "name": "Gavi", "pos": ["CM", "LW"], "ovr": 84, "att": 78, "def": 72, "phy": 75, "pac": 82, "tec": 88},
        {"id": "esp11", "name": "Olmo", "pos": ["CAM", "LW"], "ovr": 84, "att": 85, "def": 50, "phy": 72, "pac": 82, "tec": 88},
        {"id": "esp12", "name": "Fabián", "pos": ["CM", "CDM"], "ovr": 83, "att": 78, "def": 78, "phy": 80, "pac": 78, "tec": 84},
        {"id": "esp13", "name": "Williams", "pos": ["RW", "LW"], "ovr": 84, "att": 86, "def": 35, "phy": 78, "pac": 92, "tec": 82},
        {"id": "esp14", "name": "Yamal", "pos": ["RW"], "ovr": 85, "att": 86, "def": 35, "phy": 65, "pac": 88, "tec": 90},
        {"id": "esp15", "name": "Morata", "pos": ["ST"], "ovr": 83, "att": 85, "def": 40, "phy": 80, "pac": 80, "tec": 80},
        {"id": "esp16", "name": "Oyarzabal", "pos": ["ST", "LW"], "ovr": 84, "att": 86, "def": 40, "phy": 78, "pac": 80, "tec": 84},
        {"id": "esp17", "name": "Joselu", "pos": ["ST"], "ovr": 80, "att": 82, "def": 35, "phy": 82, "pac": 60, "tec": 75},
        {"id": "esp18", "name": "Merino", "pos": ["CM", "CAM"], "ovr": 82, "att": 78, "def": 75, "phy": 82, "pac": 75, "tec": 82},
        {"id": "esp19", "name": "Zubimendi", "pos": ["CDM", "CM"], "ovr": 82, "att": 70, "def": 82, "phy": 78, "pac": 72, "tec": 84},
        {"id": "esp20", "name": "Grimaldo", "pos": ["LB", "LM"], "ovr": 85, "att": 80, "def": 78, "phy": 75, "pac": 85, "tec": 88},
        {"id": "esp21", "name": "Navas", "pos": ["RB"], "ovr": 80, "att": 65, "def": 80, "phy": 72, "pac": 75, "tec": 80},
        {"id": "esp22", "name": "Remiro", "pos": ["GK"], "ovr": 80, "att": 15, "def": 80, "phy": 78, "pac": 50, "tec": 68},
        {"id": "esp23", "name": "Vivian", "pos": ["CB"], "ovr": 79, "att": 40, "def": 80, "phy": 80, "pac": 70, "tec": 70},
        {"id": "esp24", "name": "Baena", "pos": ["CAM", "LW"], "ovr": 80, "att": 82, "def": 45, "phy": 70, "pac": 82, "tec": 84},
        {"id": "esp25", "name": "Ferran", "pos": ["ST", "LW"], "ovr": 81, "att": 83, "def": 35, "phy": 75, "pac": 85, "tec": 80}
      ]
    },
    {
      "id": "por",
      "name": "Portugal",
      "short": "POR",
      "flag": "🇵🇹",
      "color": "#006600",
      "secondary": "#ff0000",
      "players": [
        {"id": "por1", "name": "Costa", "pos": ["GK"], "ovr": 85, "att": 18, "def": 85, "phy": 82, "pac": 55, "tec": 70},
        {"id": "por2", "name": "Sá", "pos": ["GK"], "ovr": 82, "att": 18, "def": 82, "phy": 80, "pac": 55, "tec": 68},
        {"id": "por3", "name": "Dias", "pos": ["CB"], "ovr": 88, "att": 50, "def": 90, "phy": 88, "pac": 75, "tec": 75},
        {"id": "por4", "name": "Pepe", "pos": ["CB"], "ovr": 82, "att": 45, "def": 85, "phy": 85, "pac": 55, "tec": 70},
        {"id": "por5", "name": "Inácio", "pos": ["CB"], "ovr": 81, "att": 50, "def": 82, "phy": 80, "pac": 78, "tec": 75},
        {"id": "por6", "name": "Cancelo", "pos": ["RB", "LB"], "ovr": 84, "att": 78, "def": 78, "phy": 75, "pac": 85, "tec": 88},
        {"id": "por7", "name": "Mendes", "pos": ["LB"], "ovr": 85, "att": 75, "def": 80, "phy": 78, "pac": 90, "tec": 82},
        {"id": "por8", "name": "Palhinha", "pos": ["CDM"], "ovr": 85, "att": 60, "def": 88, "phy": 90, "pac": 70, "tec": 75},
        {"id": "por9", "name": "Vitinha", "pos": ["CM"], "ovr": 85, "att": 78, "def": 75, "phy": 72, "pac": 78, "tec": 90},
        {"id": "por10", "name": "Bruno Fernandes", "pos": ["CAM", "CM"], "ovr": 87, "att": 88, "def": 60, "phy": 78, "pac": 75, "tec": 90},
        {"id": "por11", "name": "Bernardo", "pos": ["CAM", "RW", "LW"], "ovr": 87, "att": 86, "def": 50, "phy": 70, "pac": 80, "tec": 92},
        {"id": "por12", "name": "Ronaldo", "pos": ["ST"], "ovr": 86, "att": 90, "def": 30, "phy": 80, "pac": 82, "tec": 88},
        {"id": "por13", "name": "Leão", "pos": ["LW", "ST"], "ovr": 86, "att": 88, "def": 35, "phy": 80, "pac": 92, "tec": 85},
        {"id": "por14", "name": "Félix", "pos": ["ST", "CAM", "LW"], "ovr": 83, "att": 85, "def": 40, "phy": 72, "pac": 85, "tec": 88},
        {"id": "por15", "name": "Neto", "pos": ["RW", "LW"], "ovr": 82, "att": 84, "def": 35, "phy": 70, "pac": 90, "tec": 84},
        {"id": "por16", "name": "Silva", "pos": ["CM", "CAM"], "ovr": 81, "att": 78, "def": 70, "phy": 72, "pac": 78, "tec": 85},
        {"id": "por17", "name": "Neves", "pos": ["CM", "CDM"], "ovr": 82, "att": 75, "def": 78, "phy": 75, "pac": 72, "tec": 85},
        {"id": "por18", "name": "Dalot", "pos": ["RB", "LB"], "ovr": 81, "att": 70, "def": 78, "phy": 80, "pac": 82, "tec": 78},
        {"id": "por19", "name": "Rúben Neves", "pos": ["CDM", "CM"], "ovr": 81, "att": 72, "def": 80, "phy": 78, "pac": 70, "tec": 84},
        {"id": "por20", "name": "Jota", "pos": ["ST", "LW"], "ovr": 84, "att": 86, "def": 40, "phy": 78, "pac": 88, "tec": 82},
        {"id": "por21", "name": "Trubin", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68},
        {"id": "por22", "name": "António Silva", "pos": ["CB"], "ovr": 80, "att": 45, "def": 82, "phy": 80, "pac": 75, "tec": 72},
        {"id": "por23", "name": "Nuno Mendes", "pos": ["LB"], "ovr": 84, "att": 72, "def": 80, "phy": 78, "pac": 90, "tec": 80},
        {"id": "por24", "name": "Rafa", "pos": ["RW", "LW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 88, "tec": 82},
        {"id": "por25", "name": "Gonçalo Ramos", "pos": ["ST"], "ovr": 82, "att": 84, "def": 35, "phy": 82, "pac": 82, "tec": 78}
      ]
    },
    {
      "id": "ned",
      "name": "Netherlands",
      "short": "NED",
      "flag": "🇳🇱",
      "color": "#ff6600",
      "secondary": "#ffffff",
      "players": [
        {"id": "ned1", "name": "Verbruggen", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68},
        {"id": "ned2", "name": "Flekken", "pos": ["GK"], "ovr": 81, "att": 18, "def": 81, "phy": 80, "pac": 55, "tec": 68},
        {"id": "ned3", "name": "Van Dijk", "pos": ["CB"], "ovr": 89, "att": 55, "def": 90, "phy": 90, "pac": 75, "tec": 78},
        {"id": "ned4", "name": "De Ligt", "pos": ["CB"], "ovr": 85, "att": 50, "def": 86, "phy": 88, "pac": 70, "tec": 75},
        {"id": "ned5", "name": "Aké", "pos": ["CB", "LB"], "ovr": 82, "att": 50, "def": 84, "phy": 82, "pac": 75, "tec": 75},
        {"id": "ned6", "name": "Dumfries", "pos": ["RB"], "ovr": 83, "att": 75, "def": 78, "phy": 88, "pac": 85, "tec": 75},
        {"id": "ned7", "name": "Blind", "pos": ["LB", "CB", "CDM"], "ovr": 80, "att": 70, "def": 80, "phy": 72, "pac": 60, "tec": 85},
        {"id": "ned8", "name": "Reijnders", "pos": ["CM", "CAM"], "ovr": 83, "att": 80, "def": 72, "phy": 78, "pac": 82, "tec": 84},
        {"id": "ned9", "name": "Schouten", "pos": ["CDM", "CM"], "ovr": 81, "att": 70, "def": 82, "phy": 80, "pac": 75, "tec": 80},
        {"id": "ned10", "name": "Koopmeiners", "pos": ["CM", "CAM"], "ovr": 83, "att": 80, "def": 75, "phy": 80, "pac": 75, "tec": 85},
        {"id": "ned11", "name": "F. de Jong", "pos": ["CM"], "ovr": 86, "att": 78, "def": 78, "phy": 80, "pac": 78, "tec": 90},
        {"id": "ned12", "name": "Gakpo", "pos": ["LW", "ST", "CAM"], "ovr": 84, "att": 86, "def": 40, "phy": 80, "pac": 85, "tec": 84},
        {"id": "ned13", "name": "Xavi Simons", "pos": ["CAM", "LW", "RW"], "ovr": 83, "att": 84, "def": 40, "phy": 70, "pac": 88, "tec": 88},
        {"id": "ned14", "name": "Depay", "pos": ["ST", "LW"], "ovr": 83, "att": 85, "def": 40, "phy": 80, "pac": 82, "tec": 86},
        {"id": "ned15", "name": "Weghorst", "pos": ["ST"], "ovr": 80, "att": 82, "def": 40, "phy": 88, "pac": 60, "tec": 72},
        {"id": "ned16", "name": "Frimpong", "pos": ["RB", "RW"], "ovr": 84, "att": 80, "def": 70, "phy": 75, "pac": 95, "tec": 80},
        {"id": "ned17", "name": "Malen", "pos": ["RW", "ST"], "ovr": 81, "att": 84, "def": 35, "phy": 75, "pac": 92, "tec": 80},
        {"id": "ned18", "name": "Bergwijn", "pos": ["LW", "ST"], "ovr": 80, "att": 82, "def": 35, "phy": 75, "pac": 85, "tec": 82},
        {"id": "ned19", "name": "Timber", "pos": ["CB", "RB", "LB"], "ovr": 81, "att": 55, "def": 82, "phy": 80, "pac": 80, "tec": 78},
        {"id": "ned20", "name": "Geertruida", "pos": ["RB", "CB"], "ovr": 80, "att": 60, "def": 80, "phy": 78, "pac": 80, "tec": 75},
        {"id": "ned21", "name": "Bijlow", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68},
        {"id": "ned22", "name": "Veerman", "pos": ["CM"], "ovr": 80, "att": 78, "def": 70, "phy": 75, "pac": 70, "tec": 85},
        {"id": "ned23", "name": "Brobbey", "pos": ["ST"], "ovr": 80, "att": 82, "def": 30, "phy": 88, "pac": 85, "tec": 72},
        {"id": "ned24", "name": "Klaassen", "pos": ["CM", "CAM"], "ovr": 79, "att": 78, "def": 70, "phy": 78, "pac": 70, "tec": 80},
        {"id": "ned25", "name": "Zirkzee", "pos": ["ST", "CAM"], "ovr": 80, "att": 82, "def": 40, "phy": 80, "pac": 78, "tec": 82}
      ]
    }
  ],
  "club": [
    {
      "id": "rma",
      "name": "Real Madrid",
      "short": "RMA",
      "flag": "⚪",
      "color": "#ffffff",
      "secondary": "#febe10",
      "players": [
        {"id": "rma1", "name": "Courtois", "pos": ["GK"], "ovr": 90, "att": 20, "def": 89, "phy": 86, "pac": 55, "tec": 75},
        {"id": "rma2", "name": "Lunin", "pos": ["GK"], "ovr": 82, "att": 18, "def": 82, "phy": 80, "pac": 55, "tec": 70},
        {"id": "rma3", "name": "Militão", "pos": ["CB"], "ovr": 86, "att": 55, "def": 87, "phy": 86, "pac": 85, "tec": 72},
        {"id": "rma4", "name": "Alaba", "pos": ["CB", "LB"], "ovr": 84, "att": 70, "def": 84, "phy": 78, "pac": 78, "tec": 85},
        {"id": "rma5", "name": "Rüdiger", "pos": ["CB"], "ovr": 86, "att": 50, "def": 87, "phy": 90, "pac": 80, "tec": 70},
        {"id": "rma6", "name": "Carvajal", "pos": ["RB"], "ovr": 85, "att": 70, "def": 84, "phy": 80, "pac": 80, "tec": 82},
        {"id": "rma7", "name": "Mendy", "pos": ["LB"], "ovr": 82, "att": 65, "def": 82, "phy": 85, "pac": 85, "tec": 75},
        {"id": "rma8", "name": "Tchouaméni", "pos": ["CDM", "CM"], "ovr": 85, "att": 70, "def": 85, "phy": 86, "pac": 75, "tec": 80},
        {"id": "rma9", "name": "Camavinga", "pos": ["CM", "LB", "CDM"], "ovr": 84, "att": 72, "def": 80, "phy": 82, "pac": 85, "tec": 82},
        {"id": "rma10", "name": "Valverde", "pos": ["CM", "RM", "RB"], "ovr": 88, "att": 82, "def": 80, "phy": 88, "pac": 88, "tec": 85},
        {"id": "rma11", "name": "Bellingham", "pos": ["CM", "CAM"], "ovr": 88, "att": 85, "def": 75, "phy": 85, "pac": 82, "tec": 88},
        {"id": "rma12", "name": "Modrić", "pos": ["CM", "CAM"], "ovr": 85, "att": 80, "def": 70, "phy": 70, "pac": 70, "tec": 92},
        {"id": "rma13", "name": "Kroos", "pos": ["CM", "CDM"], "ovr": 86, "att": 80, "def": 75, "phy": 70, "pac": 55, "tec": 92},
        {"id": "rma14", "name": "Vinícius Jr", "pos": ["LW", "ST"], "ovr": 90, "att": 92, "def": 35, "phy": 75, "pac": 95, "tec": 90},
        {"id": "rma15", "name": "Rodrygo", "pos": ["RW", "ST", "LW"], "ovr": 86, "att": 88, "def": 40, "phy": 70, "pac": 90, "tec": 88},
        {"id": "rma16", "name": "Mbappé", "pos": ["ST", "LW"], "ovr": 91, "att": 93, "def": 35, "phy": 80, "pac": 97, "tec": 88},
        {"id": "rma17", "name": "Joselu", "pos": ["ST"], "ovr": 80, "att": 82, "def": 35, "phy": 82, "pac": 60, "tec": 75},
        {"id": "rma18", "name": "Brahim", "pos": ["CAM", "RW"], "ovr": 82, "att": 84, "def": 40, "phy": 68, "pac": 85, "tec": 86},
        {"id": "rma19", "name": "Güler", "pos": ["CAM", "CM"], "ovr": 80, "att": 82, "def": 40, "phy": 65, "pac": 80, "tec": 88},
        {"id": "rma20", "name": "Ceballos", "pos": ["CM", "CAM"], "ovr": 80, "att": 75, "def": 70, "phy": 70, "pac": 75, "tec": 85},
        {"id": "rma21", "name": "Nacho", "pos": ["CB", "LB", "RB"], "ovr": 80, "att": 45, "def": 82, "phy": 78, "pac": 70, "tec": 75},
        {"id": "rma22", "name": "Lucas Vázquez", "pos": ["RB", "RW"], "ovr": 80, "att": 75, "def": 75, "phy": 75, "pac": 80, "tec": 80},
        {"id": "rma23", "name": "Fran García", "pos": ["LB"], "ovr": 79, "att": 70, "def": 75, "phy": 72, "pac": 90, "tec": 78},
        {"id": "rma24", "name": "Endrick", "pos": ["ST", "RW"], "ovr": 81, "att": 84, "def": 30, "phy": 78, "pac": 88, "tec": 80},
        {"id": "rma25", "name": "Arda Güler", "pos": ["CAM", "RW"], "ovr": 80, "att": 82, "def": 40, "phy": 65, "pac": 80, "tec": 88}
      ]
    },
    {
      "id": "mci",
      "name": "Manchester City",
      "short": "MCI",
      "flag": "🔵",
      "color": "#6cabdd",
      "secondary": "#1c2c5b",
      "players": [
        {"id": "mci1", "name": "Ederson", "pos": ["GK"], "ovr": 88, "att": 25, "def": 86, "phy": 84, "pac": 65, "tec": 75},
        {"id": "mci2", "name": "Ortega", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68},
        {"id": "mci3", "name": "Dias", "pos": ["CB"], "ovr": 88, "att": 50, "def": 90, "phy": 88, "pac": 75, "tec": 75},
        {"id": "mci4", "name": "Akanji", "pos": ["CB", "RB"], "ovr": 83, "att": 55, "def": 84, "phy": 82, "pac": 78, "tec": 75},
        {"id": "mci5", "name": "Aké", "pos": ["CB", "LB"], "ovr": 82, "att": 50, "def": 84, "phy": 82, "pac": 75, "tec": 75},
        {"id": "mci6", "name": "Walker", "pos": ["RB"], "ovr": 84, "att": 60, "def": 82, "phy": 80, "pac": 90, "tec": 75},
        {"id": "mci7", "name": "Gvardiol", "pos": ["LB", "CB"], "ovr": 84, "att": 65, "def": 84, "phy": 85, "pac": 80, "tec": 78},
        {"id": "mci8", "name": "Rodri", "pos": ["CDM", "CM"], "ovr": 90, "att": 75, "def": 90, "phy": 85, "pac": 70, "tec": 88},
        {"id": "mci9", "name": "Kovacic", "pos": ["CM"], "ovr": 83, "att": 75, "def": 75, "phy": 75, "pac": 78, "tec": 88},
        {"id": "mci10", "name": "De Bruyne", "pos": ["CAM", "CM"], "ovr": 90, "att": 90, "def": 60, "phy": 78, "pac": 75, "tec": 94},
        {"id": "mci11", "name": "Bernardo", "pos": ["CAM", "RW", "LW"], "ovr": 87, "att": 86, "def": 50, "phy": 70, "pac": 80, "tec": 92},
        {"id": "mci12", "name": "Foden", "pos": ["CAM", "RW", "LW"], "ovr": 87, "att": 88, "def": 50, "phy": 72, "pac": 85, "tec": 90},
        {"id": "mci13", "name": "Grealish", "pos": ["LW", "CAM"], "ovr": 83, "att": 84, "def": 45, "phy": 72, "pac": 78, "tec": 88},
        {"id": "mci14", "name": "Doku", "pos": ["LW", "RW"], "ovr": 83, "att": 84, "def": 35, "phy": 72, "pac": 95, "tec": 85},
        {"id": "mci15", "name": "Haaland", "pos": ["ST"], "ovr": 91, "att": 94, "def": 40, "phy": 90, "pac": 90, "tec": 80},
        {"id": "mci16", "name": "Álvarez", "pos": ["ST", "CAM"], "ovr": 85, "att": 88, "def": 40, "phy": 78, "pac": 88, "tec": 84},
        {"id": "mci17", "name": "Nunes", "pos": ["CM", "RM"], "ovr": 81, "att": 75, "def": 75, "phy": 82, "pac": 85, "tec": 80},
        {"id": "mci18", "name": "Lewis", "pos": ["RB", "CM"], "ovr": 78, "att": 65, "def": 75, "phy": 70, "pac": 80, "tec": 78},
        {"id": "mci19", "name": "Stones", "pos": ["CB", "CDM"], "ovr": 85, "att": 55, "def": 86, "phy": 82, "pac": 72, "tec": 80},
        {"id": "mci20", "name": "Ake", "pos": ["CB", "LB"], "ovr": 82, "att": 50, "def": 84, "phy": 82, "pac": 75, "tec": 75},
        {"id": "mci21", "name": "Carson", "pos": ["GK"], "ovr": 75, "att": 15, "def": 75, "phy": 75, "pac": 45, "tec": 60},
        {"id": "mci22", "name": "Gomez", "pos": ["CB", "RB"], "ovr": 78, "att": 45, "def": 80, "phy": 78, "pac": 75, "tec": 70},
        {"id": "mci23", "name": "McAtee", "pos": ["CAM", "CM"], "ovr": 75, "att": 78, "def": 45, "phy": 65, "pac": 78, "tec": 80},
        {"id": "mci24", "name": "Bobb", "pos": ["RW", "CAM"], "ovr": 76, "att": 78, "def": 35, "phy": 65, "pac": 85, "tec": 80},
        {"id": "mci25", "name": "Savinho", "pos": ["RW", "LW"], "ovr": 80, "att": 82, "def": 35, "phy": 68, "pac": 90, "tec": 84}
      ]
    },
    {
      "id": "bay",
      "name": "Bayern Munich",
      "short": "BAY",
      "flag": "🔴",
      "color": "#dc052d",
      "secondary": "#ffffff",
      "players": [
        {"id": "bay1", "name": "Neuer", "pos": ["GK"], "ovr": 86, "att": 30, "def": 85, "phy": 82, "pac": 55, "tec": 80},
        {"id": "bay2", "name": "Ulreich", "pos": ["GK"], "ovr": 78, "att": 15, "def": 78, "phy": 75, "pac": 50, "tec": 65},
        {"id": "bay3", "name": "Upamecano", "pos": ["CB"], "ovr": 84, "att": 50, "def": 85, "phy": 88, "pac": 82, "tec": 70},
        {"id": "bay4", "name": "Kim", "pos": ["CB"], "ovr": 85, "att": 50, "def": 86, "phy": 85, "pac": 80, "tec": 75},
        {"id": "bay5", "name": "De Ligt", "pos": ["CB"], "ovr": 85, "att": 50, "def": 86, "phy": 88, "pac": 70, "tec": 75},
        {"id": "bay6", "name": "Davies", "pos": ["LB"], "ovr": 85, "att": 75, "def": 80, "phy": 80, "pac": 96, "tec": 80},
        {"id": "bay7", "name": "Mazraoui", "pos": ["RB", "LB"], "ovr": 82, "att": 70, "def": 80, "phy": 75, "pac": 85, "tec": 82},
        {"id": "bay8", "name": "Kimmich", "pos": ["CDM", "RB", "CM"], "ovr": 87, "att": 78, "def": 85, "phy": 80, "pac": 75, "tec": 88},
        {"id": "bay9", "name": "Goretzka", "pos": ["CM", "CDM"], "ovr": 85, "att": 80, "def": 80, "phy": 88, "pac": 78, "tec": 82},
        {"id": "bay10", "name": "Musiala", "pos": ["CAM", "CM", "LW"], "ovr": 87, "att": 88, "def": 50, "phy": 72, "pac": 85, "tec": 92},
        {"id": "bay11", "name": "Sané", "pos": ["RW", "LW"], "ovr": 84, "att": 85, "def": 35, "phy": 72, "pac": 92, "tec": 85},
        {"id": "bay12", "name": "Coman", "pos": ["LW", "RW"], "ovr": 84, "att": 85, "def": 35, "phy": 72, "pac": 92, "tec": 85},
        {"id": "bay13", "name": "Kane", "pos": ["ST"], "ovr": 89, "att": 92, "def": 45, "phy": 82, "pac": 70, "tec": 88},
        {"id": "bay14", "name": "Müller", "pos": ["CAM", "ST", "RW"], "ovr": 83, "att": 85, "def": 50, "phy": 72, "pac": 70, "tec": 88},
        {"id": "bay15", "name": "Gnabry", "pos": ["RW", "ST"], "ovr": 83, "att": 84, "def": 40, "phy": 75, "pac": 85, "tec": 84},
        {"id": "bay16", "name": "Palhinha", "pos": ["CDM"], "ovr": 85, "att": 60, "def": 88, "phy": 90, "pac": 70, "tec": 75},
        {"id": "bay17", "name": "Laimer", "pos": ["CM", "RB"], "ovr": 82, "att": 75, "def": 80, "phy": 85, "pac": 85, "tec": 78},
        {"id": "bay18", "name": "Tel", "pos": ["ST", "LW"], "ovr": 78, "att": 80, "def": 30, "phy": 72, "pac": 88, "tec": 78},
        {"id": "bay19", "name": "Guerreiro", "pos": ["LB"], "ovr": 80, "att": 75, "def": 75, "phy": 70, "pac": 80, "tec": 85},
        {"id": "bay20", "name": "Dier", "pos": ["CB"], "ovr": 79, "att": 45, "def": 80, "phy": 82, "pac": 55, "tec": 70},
        {"id": "bay21", "name": "Peretz", "pos": ["GK"], "ovr": 75, "att": 15, "def": 75, "phy": 75, "pac": 50, "tec": 65},
        {"id": "bay22", "name": "Ito", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 88, "tec": 82},
        {"id": "bay23", "name": "Goretzka", "pos": ["CM"], "ovr": 85, "att": 80, "def": 80, "phy": 88, "pac": 78, "tec": 82},
        {"id": "bay24", "name": "Choupo-Moting", "pos": ["ST"], "ovr": 78, "att": 80, "def": 35, "phy": 80, "pac": 70, "tec": 78},
        {"id": "bay25", "name": "Boey", "pos": ["RB"], "ovr": 79, "att": 65, "def": 78, "phy": 78, "pac": 88, "tec": 75}
      ]
    },
    {
      "id": "liv",
      "name": "Liverpool",
      "short": "LIV",
      "flag": "🔴",
      "color": "#c8102e",
      "secondary": "#00b2a9",
      "players": [
        {"id": "liv1", "name": "Alisson", "pos": ["GK"], "ovr": 89, "att": 20, "def": 88, "phy": 85, "pac": 60, "tec": 70},
        {"id": "liv2", "name": "Kelleher", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68},
        {"id": "liv3", "name": "Van Dijk", "pos": ["CB"], "ovr": 89, "att": 55, "def": 90, "phy": 90, "pac": 75, "tec": 78},
        {"id": "liv4", "name": "Konaté", "pos": ["CB"], "ovr": 84, "att": 48, "def": 85, "phy": 88, "pac": 80, "tec": 70},
        {"id": "liv5", "name": "Gomez", "pos": ["CB", "RB"], "ovr": 80, "att": 50, "def": 82, "phy": 80, "pac": 78, "tec": 75},
        {"id": "liv6", "name": "Alexander-Arnold", "pos": ["RB", "CM"], "ovr": 86, "att": 80, "def": 78, "phy": 75, "pac": 80, "tec": 90},
        {"id": "liv7", "name": "Robertson", "pos": ["LB"], "ovr": 85, "att": 78, "def": 82, "phy": 80, "pac": 85, "tec": 85},
        {"id": "liv8", "name": "Endo", "pos": ["CDM"], "ovr": 80, "att": 60, "def": 82, "phy": 82, "pac": 70, "tec": 75},
        {"id": "liv9", "name": "Mac Allister", "pos": ["CM", "CAM"], "ovr": 84, "att": 80, "def": 72, "phy": 78, "pac": 75, "tec": 86},
        {"id": "liv10", "name": "Szoboszlai", "pos": ["CM", "CAM", "RM"], "ovr": 83, "att": 82, "def": 70, "phy": 82, "pac": 82, "tec": 85},
        {"id": "liv11", "name": "Gravenberch", "pos": ["CM", "CDM"], "ovr": 82, "att": 75, "def": 78, "phy": 82, "pac": 82, "tec": 82},
        {"id": "liv12", "name": "Salah", "pos": ["RW", "ST"], "ovr": 89, "att": 90, "def": 40, "phy": 78, "pac": 90, "tec": 88},
        {"id": "liv13", "name": "Díaz", "pos": ["LW"], "ovr": 85, "att": 86, "def": 40, "phy": 78, "pac": 90, "tec": 85},
        {"id": "liv14", "name": "Núñez", "pos": ["ST"], "ovr": 84, "att": 86, "def": 35, "phy": 88, "pac": 90, "tec": 78},
        {"id": "liv15", "name": "Jota", "pos": ["ST", "LW"], "ovr": 84, "att": 86, "def": 40, "phy": 78, "pac": 88, "tec": 82},
        {"id": "liv16", "name": "Gakpo", "pos": ["LW", "ST", "CAM"], "ovr": 84, "att": 86, "def": 40, "phy": 80, "pac": 85, "tec": 84},
        {"id": "liv17", "name": "Elliott", "pos": ["CAM", "RW"], "ovr": 80, "att": 80, "def": 50, "phy": 65, "pac": 80, "tec": 85},
        {"id": "liv18", "name": "Jones", "pos": ["CM", "CAM"], "ovr": 79, "att": 75, "def": 70, "phy": 72, "pac": 80, "tec": 82},
        {"id": "liv19", "name": "Tsimikas", "pos": ["LB"], "ovr": 79, "att": 70, "def": 78, "phy": 75, "pac": 82, "tec": 78},
        {"id": "liv20", "name": "Quansah", "pos": ["CB"], "ovr": 78, "att": 40, "def": 80, "phy": 80, "pac": 75, "tec": 70},
        {"id": "liv21", "name": "Adrian", "pos": ["GK"], "ovr": 75, "att": 15, "def": 75, "phy": 75, "pac": 45, "tec": 60},
        {"id": "liv22", "name": "Bradley", "pos": ["RB"], "ovr": 77, "att": 65, "def": 75, "phy": 72, "pac": 85, "tec": 75},
        {"id": "liv23", "name": "Chiesa", "pos": ["RW", "LW", "ST"], "ovr": 82, "att": 84, "def": 40, "phy": 75, "pac": 88, "tec": 82},
        {"id": "liv24", "name": "Bajcetic", "pos": ["CDM", "CM"], "ovr": 75, "att": 60, "def": 75, "phy": 72, "pac": 75, "tec": 75},
        {"id": "liv25", "name": "Danns", "pos": ["ST"], "ovr": 72, "att": 75, "def": 30, "phy": 70, "pac": 80, "tec": 72}
      ]
    },
    {
      "id": "bar",
      "name": "FC Barcelona",
      "short": "BAR",
      "flag": "🔵🔴",
      "color": "#a50044",
      "secondary": "#004d98",
      "players": [
        {"id": "bar1", "name": "ter Stegen", "pos": ["GK"], "ovr": 88, "att": 25, "def": 87, "phy": 82, "pac": 55, "tec": 78},
        {"id": "bar2", "name": "Peña", "pos": ["GK"], "ovr": 78, "att": 18, "def": 78, "phy": 75, "pac": 55, "tec": 68},
        {"id": "bar3", "name": "Araujo", "pos": ["CB", "RB"], "ovr": 85, "att": 50, "def": 86, "phy": 88, "pac": 85, "tec": 70},
        {"id": "bar4", "name": "Cubarsí", "pos": ["CB"], "ovr": 80, "att": 45, "def": 82, "phy": 75, "pac": 75, "tec": 78},
        {"id": "bar5", "name": "Christensen", "pos": ["CB"], "ovr": 83, "att": 45, "def": 85, "phy": 80, "pac": 70, "tec": 78},
        {"id": "bar6", "name": "Koundé", "pos": ["RB", "CB"], "ovr": 85, "att": 65, "def": 85, "phy": 82, "pac": 85, "tec": 78},
        {"id": "bar7", "name": "Balde", "pos": ["LB"], "ovr": 83, "att": 72, "def": 78, "phy": 75, "pac": 92, "tec": 80},
        {"id": "bar8", "name": "Pedri", "pos": ["CM", "CAM"], "ovr": 86, "att": 80, "def": 70, "phy": 70, "pac": 80, "tec": 92},
        {"id": "bar9", "name": "Gavi", "pos": ["CM", "LW"], "ovr": 84, "att": 78, "def": 72, "phy": 75, "pac": 82, "tec": 88},
        {"id": "bar10", "name": "De Jong", "pos": ["CM"], "ovr": 86, "att": 78, "def": 78, "phy": 80, "pac": 78, "tec": 90},
        {"id": "bar11", "name": "Gündoğan", "pos": ["CM", "CAM"], "ovr": 84, "att": 82, "def": 70, "phy": 75, "pac": 70, "tec": 88},
        {"id": "bar12", "name": "Yamal", "pos": ["RW"], "ovr": 85, "att": 86, "def": 35, "phy": 65, "pac": 88, "tec": 90},
        {"id": "bar13", "name": "Raphinha", "pos": ["RW", "LW"], "ovr": 84, "att": 85, "def": 45, "phy": 72, "pac": 88, "tec": 85},
        {"id": "bar14", "name": "Lewandowski", "pos": ["ST"], "ovr": 88, "att": 90, "def": 40, "phy": 82, "pac": 70, "tec": 88},
        {"id": "bar15", "name": "Fati", "pos": ["LW", "ST"], "ovr": 80, "att": 82, "def": 30, "phy": 68, "pac": 90, "tec": 84},
        {"id": "bar16", "name": "Ferran", "pos": ["ST", "LW"], "ovr": 81, "att": 83, "def": 35, "phy": 75, "pac": 85, "tec": 80},
        {"id": "bar17", "name": "Olmo", "pos": ["CAM", "LW"], "ovr": 84, "att": 85, "def": 50, "phy": 72, "pac": 82, "tec": 88},
        {"id": "bar18", "name": "Casadó", "pos": ["CDM", "CM"], "ovr": 78, "att": 65, "def": 78, "phy": 75, "pac": 75, "tec": 80},
        {"id": "bar19", "name": "Cancelo", "pos": ["RB", "LB"], "ovr": 84, "att": 78, "def": 78, "phy": 75, "pac": 85, "tec": 88},
        {"id": "bar20", "name": "Iñigo", "pos": ["CB"], "ovr": 82, "att": 45, "def": 84, "phy": 80, "pac": 70, "tec": 75},
        {"id": "bar21", "name": "Iñaki Peña", "pos": ["GK"], "ovr": 78, "att": 18, "def": 78, "phy": 75, "pac": 55, "tec": 68},
        {"id": "bar22", "name": "Fort", "pos": ["RB", "LB"], "ovr": 75, "att": 60, "def": 72, "phy": 70, "pac": 85, "tec": 75},
        {"id": "bar23", "name": "Torre", "pos": ["CM", "CAM"], "ovr": 76, "att": 75, "def": 60, "phy": 68, "pac": 78, "tec": 80},
        {"id": "bar24", "name": "Pau Victor", "pos": ["ST"], "ovr": 75, "att": 78, "def": 30, "phy": 75, "pac": 80, "tec": 75},
        {"id": "bar25", "name": "Bernardo", "pos": ["CAM"], "ovr": 78, "att": 80, "def": 40, "phy": 68, "pac": 78, "tec": 84}
      ]
    },
    {
      "id": "psg",
      "name": "Paris Saint-Germain",
      "short": "PSG",
      "flag": "🔵🔴",
      "color": "#004170",
      "secondary": "#e2b013",
      "players": [
        {"id": "psg1", "name": "Donnarumma", "pos": ["GK"], "ovr": 88, "att": 20, "def": 87, "phy": 88, "pac": 60, "tec": 70},
        {"id": "psg2", "name": "Safonov", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 80, "pac": 55, "tec": 68},
        {"id": "psg3", "name": "Marquinhos", "pos": ["CB"], "ovr": 87, "att": 50, "def": 90, "phy": 85, "pac": 78, "tec": 75},
        {"id": "psg4", "name": "Skriniar", "pos": ["CB"], "ovr": 82, "att": 40, "def": 84, "phy": 85, "pac": 65, "tec": 70},
        {"id": "psg5", "name": "Pacho", "pos": ["CB"], "ovr": 81, "att": 45, "def": 82, "phy": 82, "pac": 78, "tec": 72},
        {"id": "psg6", "name": "Hakimi", "pos": ["RB"], "ovr": 85, "att": 80, "def": 78, "phy": 80, "pac": 92, "tec": 82},
        {"id": "psg7", "name": "Mendes", "pos": ["LB"], "ovr": 85, "att": 75, "def": 80, "phy": 78, "pac": 90, "tec": 82},
        {"id": "psg8", "name": "Vitinha", "pos": ["CM"], "ovr": 85, "att": 78, "def": 75, "phy": 72, "pac": 78, "tec": 90},
        {"id": "psg9", "name": "Ugarte", "pos": ["CDM"], "ovr": 82, "att": 60, "def": 84, "phy": 85, "pac": 75, "tec": 75},
        {"id": "psg10", "name": "Zaire-Emery", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 75, "phy": 75, "pac": 82, "tec": 82},
        {"id": "psg11", "name": "Lee", "pos": ["CAM", "CM"], "ovr": 82, "att": 82, "def": 55, "phy": 70, "pac": 80, "tec": 88},
        {"id": "psg12", "name": "Dembélé", "pos": ["RW", "LW"], "ovr": 85, "att": 86, "def": 35, "phy": 70, "pac": 92, "tec": 88},
        {"id": "psg13", "name": "Barcola", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 90, "tec": 82},
        {"id": "psg14", "name": "Kvaratskhelia", "pos": ["LW", "RW"], "ovr": 86, "att": 88, "def": 40, "phy": 75, "pac": 85, "tec": 90},
        {"id": "psg15", "name": "Mbappé", "pos": ["ST", "LW"], "ovr": 91, "att": 93, "def": 35, "phy": 80, "pac": 97, "tec": 88},
        {"id": "psg16", "name": "Ramos", "pos": ["ST"], "ovr": 82, "att": 84, "def": 35, "phy": 82, "pac": 82, "tec": 78},
        {"id": "psg17", "name": "Asensio", "pos": ["CAM", "RW"], "ovr": 82, "att": 84, "def": 40, "phy": 68, "pac": 78, "tec": 88},
        {"id": "psg18", "name": "Ruiz", "pos": ["CM"], "ovr": 81, "att": 78, "def": 72, "phy": 75, "pac": 75, "tec": 85},
        {"id": "psg19", "name": "Hernández", "pos": ["LB"], "ovr": 85, "att": 75, "def": 82, "phy": 80, "pac": 88, "tec": 80},
        {"id": "psg20", "name": "Beraldo", "pos": ["CB"], "ovr": 78, "att": 40, "def": 80, "phy": 78, "pac": 75, "tec": 70},
        {"id": "psg21", "name": "Navas", "pos": ["GK"], "ovr": 82, "att": 15, "def": 82, "phy": 75, "pac": 55, "tec": 75},
        {"id": "psg22", "name": "Zaïre-Emery", "pos": ["CM"], "ovr": 80, "att": 72, "def": 75, "phy": 75, "pac": 82, "tec": 82},
        {"id": "psg23", "name": "Mayulu", "pos": ["ST", "CAM"], "ovr": 75, "att": 78, "def": 30, "phy": 70, "pac": 80, "tec": 78},
        {"id": "psg24", "name": "Mukiele", "pos": ["RB", "CB"], "ovr": 78, "att": 55, "def": 80, "phy": 82, "pac": 85, "tec": 70},
        {"id": "psg25", "name": "Soler", "pos": ["CM", "RM"], "ovr": 79, "att": 75, "def": 70, "phy": 75, "pac": 78, "tec": 82}
      ]
    },
    {
      "id": "int",
      "name": "Inter Milan",
      "short": "INT",
      "flag": "🔵⚫",
      "color": "#010e80",
      "secondary": "#000000",
      "players": [
        {"id": "int1", "name": "Sommer", "pos": ["GK"], "ovr": 87, "att": 18, "def": 86, "phy": 80, "pac": 50, "tec": 72},
        {"id": "int2", "name": "Di Gennaro", "pos": ["GK"], "ovr": 75, "att": 15, "def": 75, "phy": 75, "pac": 45, "tec": 60},
        {"id": "int3", "name": "Bastoni", "pos": ["CB"], "ovr": 86, "att": 60, "def": 86, "phy": 82, "pac": 75, "tec": 82},
        {"id": "int4", "name": "Acerbi", "pos": ["CB"], "ovr": 84, "att": 40, "def": 86, "phy": 82, "pac": 55, "tec": 72},
        {"id": "int5", "name": "De Vrij", "pos": ["CB"], "ovr": 83, "att": 40, "def": 85, "phy": 80, "pac": 60, "tec": 75},
        {"id": "int6", "name": "Dumfries", "pos": ["RB"], "ovr": 83, "att": 75, "def": 78, "phy": 88, "pac": 85, "tec": 75},
        {"id": "int7", "name": "Dimarco", "pos": ["LB", "LM"], "ovr": 84, "att": 80, "def": 78, "phy": 78, "pac": 82, "tec": 85},
        {"id": "int8", "name": "Barella", "pos": ["CM"], "ovr": 87, "att": 80, "def": 80, "phy": 82, "pac": 82, "tec": 88},
        {"id": "int9", "name": "Çalhanoğlu", "pos": ["CDM", "CM"], "ovr": 86, "att": 82, "def": 80, "phy": 75, "pac": 70, "tec": 90},
        {"id": "int10", "name": "Mkhitaryan", "pos": ["CM", "CAM"], "ovr": 83, "att": 80, "def": 70, "phy": 78, "pac": 75, "tec": 85},
        {"id": "int11", "name": "Lautaro", "pos": ["ST"], "ovr": 87, "att": 90, "def": 35, "phy": 82, "pac": 82, "tec": 85},
        {"id": "int12", "name": "Thuram", "pos": ["ST", "RW"], "ovr": 84, "att": 86, "def": 40, "phy": 85, "pac": 88, "tec": 80},
        {"id": "int13", "name": "Frattesi", "pos": ["CM", "CAM"], "ovr": 82, "att": 80, "def": 70, "phy": 80, "pac": 82, "tec": 80},
        {"id": "int14", "name": "Taremi", "pos": ["ST"], "ovr": 80, "att": 82, "def": 35, "phy": 78, "pac": 75, "tec": 82},
        {"id": "int15", "name": "Asllani", "pos": ["CDM", "CM"], "ovr": 78, "att": 70, "def": 78, "phy": 72, "pac": 75, "tec": 80},
        {"id": "int16", "name": "Darmian", "pos": ["RB", "CB", "LB"], "ovr": 80, "att": 60, "def": 82, "phy": 75, "pac": 70, "tec": 75},
        {"id": "int17", "name": "Carlos Augusto", "pos": ["LB", "LM"], "ovr": 80, "att": 68, "def": 78, "phy": 76, "pac": 82, "tec": 78},
        {"id": "int18", "name": "Bisseck", "pos": ["CB"], "ovr": 78, "att": 45, "def": 80, "phy": 85, "pac": 80, "tec": 68},
        {"id": "int19", "name": "Arnautovic", "pos": ["ST"], "ovr": 79, "att": 82, "def": 35, "phy": 82, "pac": 70, "tec": 78},
        {"id": "int20", "name": "Pavard", "pos": ["CB", "RB"], "ovr": 81, "att": 60, "def": 82, "phy": 80, "pac": 75, "tec": 75},
        {"id": "int21", "name": "Audero", "pos": ["GK"], "ovr": 78, "att": 15, "def": 78, "phy": 78, "pac": 50, "tec": 65},
        {"id": "int22", "name": "Zielinski", "pos": ["CM", "CAM"], "ovr": 81, "att": 80, "def": 65, "phy": 70, "pac": 78, "tec": 86},
        {"id": "int23", "name": "Correa", "pos": ["ST", "RW"], "ovr": 78, "att": 80, "def": 35, "phy": 70, "pac": 85, "tec": 82},
        {"id": "int24", "name": "Buchanan", "pos": ["RW", "RB"], "ovr": 77, "att": 78, "def": 55, "phy": 72, "pac": 90, "tec": 75},
        {"id": "int25", "name": "Acerbi", "pos": ["CB"], "ovr": 84, "att": 40, "def": 86, "phy": 82, "pac": 55, "tec": 72}
      ]
    },
    {
      "id": "ars",
      "name": "Arsenal",
      "short": "ARS",
      "flag": "🔴⚪",
      "color": "#ef0107",
      "secondary": "#ffffff",
      "players": [
        {"id": "ars1", "name": "Raya", "pos": ["GK"], "ovr": 83, "att": 20, "def": 83, "phy": 78, "pac": 55, "tec": 72},
        {"id": "ars2", "name": "Ramsdale", "pos": ["GK"], "ovr": 81, "att": 18, "def": 81, "phy": 78, "pac": 55, "tec": 68},
        {"id": "ars3", "name": "Saliba", "pos": ["CB"], "ovr": 87, "att": 45, "def": 88, "phy": 85, "pac": 80, "tec": 75},
        {"id": "ars4", "name": "Gabriel", "pos": ["CB"], "ovr": 85, "att": 50, "def": 86, "phy": 88, "pac": 75, "tec": 72},
        {"id": "ars5", "name": "White", "pos": ["RB", "CB"], "ovr": 83, "att": 60, "def": 84, "phy": 80, "pac": 75, "tec": 78},
        {"id": "ars6", "name": "Timber", "pos": ["RB", "LB", "CB"], "ovr": 81, "att": 55, "def": 82, "phy": 80, "pac": 80, "tec": 78},
        {"id": "ars7", "name": "Zinchenko", "pos": ["LB", "CM"], "ovr": 80, "att": 75, "def": 78, "phy": 72, "pac": 75, "tec": 85},
        {"id": "ars8", "name": "Rice", "pos": ["CDM", "CM"], "ovr": 87, "att": 70, "def": 88, "phy": 88, "pac": 75, "tec": 80},
        {"id": "ars9", "name": "Ødegaard", "pos": ["CAM", "CM"], "ovr": 87, "att": 86, "def": 55, "phy": 70, "pac": 78, "tec": 92},
        {"id": "ars10", "name": "Partey", "pos": ["CDM", "CM"], "ovr": 82, "att": 70, "def": 82, "phy": 82, "pac": 70, "tec": 80},
        {"id": "ars11", "name": "Saka", "pos": ["RW", "RM"], "ovr": 87, "att": 88, "def": 50, "phy": 75, "pac": 90, "tec": 88},
        {"id": "ars12", "name": "Martinelli", "pos": ["LW", "RW"], "ovr": 83, "att": 84, "def": 40, "phy": 72, "pac": 90, "tec": 82},
        {"id": "ars13", "name": "Trossard", "pos": ["LW", "ST", "CAM"], "ovr": 82, "att": 84, "def": 45, "phy": 72, "pac": 82, "tec": 85},
        {"id": "ars14", "name": "Havertz", "pos": ["ST", "CAM", "CM"], "ovr": 84, "att": 85, "def": 55, "phy": 80, "pac": 80, "tec": 84},
        {"id": "ars15", "name": "Jesus", "pos": ["ST", "RW"], "ovr": 82, "att": 84, "def": 45, "phy": 78, "pac": 85, "tec": 84},
        {"id": "ars16", "name": "Nwaneri", "pos": ["CAM", "CM"], "ovr": 75, "att": 78, "def": 45, "phy": 65, "pac": 80, "tec": 80},
        {"id": "ars17", "name": "Jorginho", "pos": ["CDM", "CM"], "ovr": 80, "att": 70, "def": 80, "phy": 70, "pac": 60, "tec": 88},
        {"id": "ars18", "name": "Tomiyasu", "pos": ["RB", "LB", "CB"], "ovr": 80, "att": 55, "def": 82, "phy": 80, "pac": 75, "tec": 75},
        {"id": "ars19", "name": "Kiwior", "pos": ["CB", "LB"], "ovr": 78, "att": 45, "def": 80, "phy": 80, "pac": 75, "tec": 70},
        {"id": "ars20", "name": "Neto", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68},
        {"id": "ars21", "name": "Calafiori", "pos": ["LB", "CB"], "ovr": 81, "att": 65, "def": 80, "phy": 80, "pac": 80, "tec": 80},
        {"id": "ars22", "name": "Merino", "pos": ["CM", "CAM"], "ovr": 82, "att": 78, "def": 75, "phy": 82, "pac": 75, "tec": 82},
        {"id": "ars23", "name": "Sterling", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 40, "phy": 70, "pac": 88, "tec": 82},
        {"id": "ars24", "name": "Zinchenko", "pos": ["LB"], "ovr": 80, "att": 75, "def": 78, "phy": 72, "pac": 75, "tec": 85},
        {"id": "ars25", "name": "Vieira", "pos": ["CM", "CAM"], "ovr": 76, "att": 75, "def": 60, "phy": 70, "pac": 80, "tec": 80}
      ]
    }
  ]
}
;

  let teamsData = { national: [], club: [] };
  let allTeams = [];
  let stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, cards: {}, motm: {} };
  let currentMatch = null;
  let simInterval = null;
  let simSpeed = 400;
  let isPlaying = false;
  let tournament = null;
  let tournamentType = 'worldcup';

  const FORMATIONS = {
    '4-3-3': { name: '4-3-3', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'] },
    '4-4-2': { name: '4-4-2', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'] },
    '4-2-3-1': { name: '4-2-3-1', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'] },
    '3-5-2': { name: '3-5-2', slots: ['GK','CB','CB','CB','RWB','CM','CM','CM','LWB','ST','ST'] },
    '4-5-1': { name: '4-5-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CDM','CM','LM','ST'] },
    '3-4-3': { name: '3-4-3', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'] },
    '5-3-2': { name: '5-3-2', slots: ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'] },
    '4-1-4-1': { name: '4-1-4-1', slots: ['GK','RB','CB','CB','LB','CDM','RM','CM','CM','LM','ST'] }
  };

  const POS_COMPAT = {
    GK: ['GK'], CB: ['CB','RB','LB'], RB: ['RB','CB','RWB','RM'], LB: ['LB','CB','LWB','LM'],
    RWB: ['RWB','RB','RM'], LWB: ['LWB','LB','LM'], CDM: ['CDM','CM','CB'], CM: ['CM','CDM','CAM'],
    CAM: ['CAM','CM','RW','LW','ST'], RM: ['RM','RW','RWB','CM'], LM: ['LM','LW','LWB','CM'],
    RW: ['RW','RM','ST','CAM'], LW: ['LW','LM','ST','CAM'], ST: ['ST','RW','LW','CAM']
  };

  function init() {
    try {
      teamsData = TEAMS_DATA;
      allTeams = [...(teamsData.national || []), ...(teamsData.club || [])];
      if (!allTeams.length) throw new Error('No teams found');
      loadStats();
      populateTeamSelects();
      populateFormations();
      bindNav();
      renderTeamsList();
      console.log('Apex Sim ready:', allTeams.length, 'teams');
    } catch (e) {
      console.error(e);
      alert('Error loading game: ' + e.message);
    }
  }

  function bindNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        if (view) switchView(view);
      });
    });
  }

  function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const viewEl = document.getElementById('view-' + view);
    if (viewEl) viewEl.classList.add('active');
    const tabEl = document.querySelector(`.nav-tab[data-view="${view}"]`);
    if (tabEl) tabEl.classList.add('active');
    if (view === 'leaderboard') showLeaderboard('goals');
    if (view === 'teams') renderTeamsList();
  }

  function goToMatch() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
  }

  function goToTournament(type) {
    tournamentType = type || 'worldcup';
    switchView('tournament');
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    const isWC = tournamentType === 'worldcup';
    const title = document.getElementById('tournament-title');
    const desc = document.getElementById('tournament-desc');
    if (title) title.textContent = isWC ? 'World Cup Setup' : 'Champions League Setup';
    if (desc) desc.textContent = isWC
      ? 'Select national teams. Minimum 4 (8 or 16 recommended).'
      : 'Select club teams. Minimum 4 for knockout tournament.';
    renderTournamentTeamSelect();
  }

  function populateTeamSelects() {
    const home = document.getElementById('home-team');
    const away = document.getElementById('away-team');
    if (!home || !away) return;
    home.innerHTML = ''; away.innerHTML = '';
    const groups = [
      { label: 'National Teams', teams: teamsData.national || [] },
      { label: 'Club Teams', teams: teamsData.club || [] }
    ];
    groups.forEach(g => {
      if (!g.teams.length) return;
      const og1 = document.createElement('optgroup'); og1.label = g.label;
      const og2 = document.createElement('optgroup'); og2.label = g.label;
      g.teams.forEach(t => {
        og1.appendChild(new Option((t.flag || '') + ' ' + t.name, t.id));
        og2.appendChild(new Option((t.flag || '') + ' ' + t.name, t.id));
      });
      home.appendChild(og1); away.appendChild(og2);
    });
    if ((teamsData.national || []).length > 1) {
      home.value = teamsData.national[0].id;
      away.value = teamsData.national[1].id;
    } else if (allTeams.length > 1) {
      home.value = allTeams[0].id;
      away.value = allTeams[1].id;
    }
    updateTeamPreview('home');
    updateTeamPreview('away');
  }

  function populateFormations() {
    ['home-formation', 'away-formation'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      Object.keys(FORMATIONS).forEach(k => sel.appendChild(new Option(FORMATIONS[k].name, k)));
      sel.value = '4-3-3';
    });
  }

  function getTeam(id) { return allTeams.find(t => t.id === id); }

  function updateTeamPreview(side) {
    const sel = document.getElementById(side + '-team');
    const el = document.getElementById(side + '-preview');
    if (!sel || !el) return;
    const team = getTeam(sel.value);
    if (!team) { el.innerHTML = ''; return; }
    el.innerHTML = `<span class="team-flag">${team.flag || ''}</span><div><div class="team-name">${team.name}</div><div style="font-size:0.8rem;color:var(--text-muted)">${(team.players||[]).length} players</div></div>`;
  }

  function buildSquad(team, formationKey) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const players = shuffleArray([...(team.players || [])]);
    const used = new Set();
    const starting = [];
    for (const slot of formation.slots) {
      const candidates = players.filter(p => !used.has(p.id) && canPlay(p, slot))
        .sort((a, b) => {
          const aExact = (a.pos || []).includes(slot) ? 1 : 0;
          const bExact = (b.pos || []).includes(slot) ? 1 : 0;
          if (bExact !== aExact) return bExact - aExact;
          return (b.ovr || 70) - (a.ovr || 70);
        });
      if (candidates.length) {
        used.add(candidates[0].id);
        starting.push({ ...candidates[0], slot, isStarter: true });
      }
    }
    // Fallback fill if not enough
    while (starting.length < 11) {
      const leftover = players.find(p => !used.has(p.id));
      if (!leftover) break;
      used.add(leftover.id);
      starting.push({ ...leftover, slot: (leftover.pos || ['CM'])[0], isStarter: true });
    }
    const remaining = players.filter(p => !used.has(p.id)).sort((a, b) => (b.ovr||70) - (a.ovr||70));
    const subs = [];
    for (let i = 0; i < remaining.length && (starting.length + subs.length) < 25; i++) {
      subs.push({ ...remaining[i], slot: (remaining[i].pos || ['CM'])[0], isStarter: false });
    }
    return { starting, subs, formation: formationKey, all: [...starting, ...subs] };
  }

  function canPlay(player, slot) {
    const positions = player.pos || [];
    return positions.some(p => (POS_COMPAT[slot] || [slot]).includes(p) || p === slot);
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startMatch() {
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (!homeSel || !awaySel) return;
    const homeId = homeSel.value;
    const awayId = awaySel.value;
    if (!homeId || !awayId || homeId === awayId) { toast('Select two different teams'); return; }
    const homeTeam = getTeam(homeId);
    const awayTeam = getTeam(awayId);
    if (!homeTeam || !awayTeam) { toast('Team not found'); return; }
    const homeForm = (document.getElementById('home-formation') || {}).value || '4-3-3';
    const awayForm = (document.getElementById('away-formation') || {}).value || '4-3-3';
    const homeSquad = buildSquad(homeTeam, homeForm);
    const awaySquad = buildSquad(awayTeam, awayForm);

    currentMatch = {
      home: { team: homeTeam, squad: homeSquad, score: 0, stats: blankStats() },
      away: { team: awayTeam, squad: awaySquad, score: 0, stats: blankStats() },
      minute: 0, events: [], status: '1st Half', finished: false,
      homeOnPitch: homeSquad.starting.map(p => p.id),
      awayOnPitch: awaySquad.starting.map(p => p.id),
      homeSubsUsed: 0, awaySubsUsed: 0, maxSubs: 5,
      injuries: [], cards: { home: {}, away: {} }, possession: 50
    };

    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    updateScoreboard();
    renderLineups();
    const feed = document.getElementById('events-feed');
    if (feed) feed.innerHTML = '';
    addEvent(0, 'whistle', 'Kick off!', null);
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
  }

  function blankStats() {
    return { shots: 0, shotsOn: 0, possession: 50, fouls: 0, corners: 0, saves: 0, passes: 0, yellows: 0, reds: 0 };
  }

  function quickSimMatch() { startMatch(); if (currentMatch) simToEnd(); }

  function toggleSim() {
    if (!currentMatch || currentMatch.finished) return;
    isPlaying = !isPlaying;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    if (isPlaying) {
      simInterval = setInterval(() => {
        if (!currentMatch || currentMatch.finished) {
          clearInterval(simInterval); isPlaying = false;
          if (btn) btn.textContent = '▶ Play';
          return;
        }
        tick();
      }, simSpeed);
    } else {
      clearInterval(simInterval);
    }
  }

  function setSpeed(val) {
    simSpeed = parseInt(val) || 400;
    const labels = { 800: 'Slow', 400: 'Normal', 150: 'Fast', 40: 'Turbo' };
    const lbl = document.getElementById('sim-speed-label');
    if (lbl) lbl.textContent = 'Speed: ' + (labels[val] || 'Custom');
    if (isPlaying) {
      clearInterval(simInterval);
      simInterval = setInterval(() => {
        if (!currentMatch || currentMatch.finished) { clearInterval(simInterval); isPlaying = false; return; }
        tick();
      }, simSpeed);
    }
  }

  function simToEnd() {
    if (!currentMatch || currentMatch.finished) return;
    clearInterval(simInterval); isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    let safety = 0;
    while (currentMatch && !currentMatch.finished && safety < 200) {
      tick(true);
      safety++;
    }
  }

  function resetMatch() {
    clearInterval(simInterval); isPlaying = false; currentMatch = null;
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
  }

  function tick(silent) {
    if (!currentMatch || currentMatch.finished) return;
    const m = currentMatch;
    m.minute++;
    if (m.minute === 45) {
      m.status = 'Half Time';
      addEvent(45, 'whistle', 'Half time', null);
      updateScoreboard();
      if (!silent) return;
    }
    if (m.minute === 46) {
      m.status = '2nd Half';
      addEvent(46, 'whistle', 'Second half begins', null);
    }
    if (m.minute >= 90) {
      const stoppage = 1 + Math.floor(Math.random() * 5);
      if (m.minute >= 90 + stoppage) { endMatch(); return; }
      m.status = 'Stoppage Time';
    }
    generateEvents();
    if (m.minute >= 55 && m.minute <= 85 && Math.random() < 0.08) {
      trySubstitution(Math.random() < 0.5 ? 'home' : 'away');
    }
    if (Math.random() < 0.012) tryInjury(Math.random() < 0.5 ? 'home' : 'away');
    updateScoreboard();
    if (!silent) updateStatsPanel();
  }

  function generateEvents() {
    const m = currentMatch;
    if (!m) return;
    const homeStr = calcTeamStrength(m.home);
    const awayStr = calcTeamStrength(m.away);
    const total = homeStr.att + awayStr.att + 50;
    const homeChance = (homeStr.att + 10) / total;
    m.possession = Math.max(30, Math.min(70, m.possession + (Math.random() - 0.5) * 4));
    m.home.stats.possession = Math.round(m.possession);
    m.away.stats.possession = 100 - m.home.stats.possession;
    if (Math.random() > 0.55) return;

    const r = Math.random();
    const attackingSide = Math.random() < homeChance ? 'home' : 'away';
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defendingSide];

    if (r < 0.22) {
      const shooter = pickPlayer(attTeam, ['ST','RW','LW','CAM','CM','RM','LM']);
      if (!shooter) return;
      attTeam.stats.shots++;
      if (Math.random() < (0.35 + (shooter.att || 70) / 300)) {
        attTeam.stats.shotsOn++;
        const gk = pickPlayer(defTeam, ['GK']);
        if (Math.random() < (gk ? 0.55 + (gk.def || 70) / 400 : 0.6)) {
          if (gk) {
            defTeam.stats.saves++;
            recordStat('saves', gk, defTeam.team);
            addEvent(m.minute, 'save', `Great save by <span class="player">${gk.name}</span>!`, attackingSide);
          }
        } else {
          const assister = pickPlayer(attTeam, ['CAM','CM','RW','LW','ST','RM','LM'], shooter.id);
          attTeam.score++;
          recordStat('goals', shooter, attTeam.team);
          if (assister && Math.random() < 0.7) {
            recordStat('assists', assister, attTeam.team);
            addEvent(m.minute, 'goal', `GOAL! <span class="player">${shooter.name}</span> scores! Assisted by <span class="player">${assister.name}</span>`, attackingSide, true);
          } else {
            addEvent(m.minute, 'goal', `GOAL! <span class="player">${shooter.name}</span> finds the net!`, attackingSide, true);
          }
        }
      } else {
        addEvent(m.minute, 'shot', `Shot by <span class="player">${shooter.name}</span> goes wide`, attackingSide);
      }
    } else if (r < 0.32) {
      attTeam.stats.corners++;
      addEvent(m.minute, 'corner', `Corner for ${attTeam.team.short}`, attackingSide);
      if (Math.random() < 0.12) {
        const scorer = pickPlayer(attTeam, ['ST','CB','CM','CAM']);
        if (scorer) {
          attTeam.score++;
          recordStat('goals', scorer, attTeam.team);
          addEvent(m.minute, 'goal', `GOAL from the corner! <span class="player">${scorer.name}</span>!`, attackingSide, true);
        }
      }
    } else if (r < 0.45) {
      const fouler = pickPlayer(defTeam, ['CB','CDM','CM','RB','LB','ST']);
      if (!fouler) return;
      defTeam.stats.fouls++;
      const cardRoll = Math.random();
      if (cardRoll < 0.12) {
        m.cards[defendingSide][fouler.id] = (m.cards[defendingSide][fouler.id] || 0) + 1;
        defTeam.stats.yellows++;
        recordStat('cards', fouler, defTeam.team);
        if (m.cards[defendingSide][fouler.id] >= 2) {
          defTeam.stats.reds++;
          addEvent(m.minute, 'red', `RED CARD! <span class="player">${fouler.name}</span> sent off (2nd yellow)`, defendingSide);
          removeFromPitch(defendingSide, fouler.id);
        } else {
          addEvent(m.minute, 'yellow', `Yellow card for <span class="player">${fouler.name}</span>`, defendingSide);
        }
      } else if (cardRoll < 0.15) {
        defTeam.stats.reds++;
        recordStat('cards', fouler, defTeam.team);
        addEvent(m.minute, 'red', `RED CARD! <span class="player">${fouler.name}</span> is sent off!`, defendingSide);
        removeFromPitch(defendingSide, fouler.id);
      } else {
        addEvent(m.minute, 'foul', `Foul by <span class="player">${fouler.name}</span>`, defendingSide);
      }
    } else if (r < 0.55) {
      const taker = pickPlayer(attTeam, ['CAM','CM','ST','RW','LW']);
      if (taker && Math.random() < 0.15) {
        attTeam.stats.shots++; attTeam.stats.shotsOn++;
        if (Math.random() < 0.3) {
          attTeam.score++;
          recordStat('goals', taker, attTeam.team);
          addEvent(m.minute, 'goal', `Brilliant free-kick! <span class="player">${taker.name}</span> scores!`, attackingSide, true);
        } else {
          addEvent(m.minute, 'shot', `Free-kick by <span class="player">${taker.name}</span> saved/wide`, attackingSide);
        }
      }
    } else if (r < 0.65) {
      const p = pickPlayer(attTeam, ['CM','CAM','CDM','RB','LB']);
      if (p) {
        attTeam.stats.passes++;
        if (Math.random() < 0.3) addEvent(m.minute, 'pass', `Nice play involving <span class="player">${p.name}</span>`, attackingSide);
      }
    } else if (r < 0.72) {
      const p = pickPlayer(attTeam, ['ST','RW','LW']);
      if (p) addEvent(m.minute, 'offside', `Offside against <span class="player">${p.name}</span>`, attackingSide);
    } else if (r < 0.8) {
      const p = pickPlayer(attTeam, ['ST','CAM','RW','LW']);
      if (p) {
        attTeam.stats.shots++;
        addEvent(m.minute, 'miss', `Big chance missed by <span class="player">${p.name}</span>!`, attackingSide);
      }
    } else if (Math.random() < 0.4) {
      addEvent(m.minute, 'pressure', `${attTeam.team.short} applying pressure`, attackingSide);
    }
  }

  function calcTeamStrength(side) {
    if (!currentMatch) return { att: 50, def: 50 };
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const onPitch = (side.squad.all || []).filter(p => ids.includes(p.id));
    if (!onPitch.length) return { att: 50, def: 50 };
    return {
      att: onPitch.reduce((s, p) => s + (p.att || 70), 0) / onPitch.length,
      def: onPitch.reduce((s, p) => s + (p.def || 70), 0) / onPitch.length
    };
  }

  function pickPlayer(side, preferredPos, excludeId) {
    if (!currentMatch) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
    if (preferred.length) pool = preferred;
    if (!pool.length) return null;
    pool.sort((a, b) => ((b.ovr || 70) + Math.random() * 15) - ((a.ovr || 70) + Math.random() * 15));
    return pool[0];
  }

  function trySubstitution(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used >= m.maxSubs) return;
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const onPitch = (sideData.squad.starting || []).filter(p => onPitchIds.includes(p.id));
    const sorted = [...onPitch].sort((a, b) => (a.ovr || 70) - (b.ovr || 70));
    const candidatesOut = sorted.slice(0, Math.max(2, Math.floor(sorted.length / 2)));
    if (!candidatesOut.length) return;
    const outPlayer = candidatesOut[Math.floor(Math.random() * candidatesOut.length)];
    const availableSubs = (sideData.squad.subs || []).filter(p => !onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
    if (!availableSubs.length) return;
    let candidatesIn = availableSubs.filter(p => canPlay(p, outPlayer.slot));
    if (!candidatesIn.length) candidatesIn = availableSubs;
    candidatesIn.sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
    const top = candidatesIn.slice(0, Math.min(3, candidatesIn.length));
    const inPlayer = top[Math.floor(Math.random() * top.length)];
    const idx = onPitchIds.indexOf(outPlayer.id);
    if (idx >= 0) onPitchIds[idx] = inPlayer.id;
    if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
    addEvent(m.minute, 'sub', `Substitution (${sideData.team.short}): <span class="player">${inPlayer.name}</span> replaces <span class="player">${outPlayer.name}</span>`, side);
  }

  function tryInjury(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const pool = (sideData.squad.all || []).filter(p => onPitchIds.includes(p.id) && (p.pos || [])[0] !== 'GK');
    if (!pool.length) return;
    const injured = pool[Math.floor(Math.random() * pool.length)];
    m.injuries.push(injured.id);
    addEvent(m.minute, 'injury', `⚠ Injury! <span class="player">${injured.name}</span> is down`, side);
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used < m.maxSubs) {
      const availableSubs = (sideData.squad.subs || []).filter(p => !onPitchIds.includes(p.id) && !m.injuries.includes(p.id));
      if (availableSubs.length) {
        let candidates = availableSubs.filter(p => canPlay(p, injured.slot || (injured.pos || ['CM'])[0]));
        if (!candidates.length) candidates = availableSubs;
        candidates.sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
        const inPlayer = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
        const idx = onPitchIds.indexOf(injured.id);
        if (idx >= 0) onPitchIds[idx] = inPlayer.id;
        if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
        addEvent(m.minute, 'sub', `Forced sub: <span class="player">${inPlayer.name}</span> comes on for injured <span class="player">${injured.name}</span>`, side);
      } else {
        removeFromPitch(side, injured.id);
      }
    } else {
      removeFromPitch(side, injured.id);
    }
  }

  function removeFromPitch(side, playerId) {
    if (!currentMatch) return;
    const arr = side === 'home' ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const idx = arr.indexOf(playerId);
    if (idx >= 0) arr.splice(idx, 1);
  }

  function endMatch() {
    const m = currentMatch;
    if (!m) return;
    m.finished = true; m.status = 'Full Time'; m.minute = 90;
    clearInterval(simInterval); isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
    addEvent(90, 'whistle', `Full Time! ${m.home.team.short} ${m.home.score} - ${m.away.score} ${m.away.team.short}`, null);
    if (m.away.score === 0) {
      const gk = (m.home.squad.starting || []).find(p => (p.pos || []).includes('GK'));
      if (gk) recordStat('cleanSheets', gk, m.home.team);
    }
    if (m.home.score === 0) {
      const gk = (m.away.squad.starting || []).find(p => (p.pos || []).includes('GK'));
      if (gk) recordStat('cleanSheets', gk, m.away.team);
    }
    const allPlayers = [...(m.home.squad.all || []), ...(m.away.squad.all || [])];
    let best = null, bestScore = -1;
    allPlayers.forEach(p => {
      const g = (stats.goals[p.id] || {}).count || 0;
      const a = (stats.assists[p.id] || {}).count || 0;
      const s = (stats.saves[p.id] || {}).count || 0;
      const score = g * 3 + a * 2 + s * 0.5 + (p.ovr || 70) / 20 + Math.random();
      if (score > bestScore) { bestScore = score; best = p; }
    });
    if (best) {
      const team = (m.home.squad.all || []).find(p => p.id === best.id) ? m.home.team : m.away.team;
      recordStat('motm', best, team);
      addEvent(90, 'motm', `Man of the Match: <span class="player">${best.name}</span>`, null);
    }
    saveStats();
    updateScoreboard();
    updateStatsPanel();
  }

  function addEvent(minute, type, text, side, isGoal) {
    if (!currentMatch) return;
    currentMatch.events.push({ minute, type, text, side });
    const feed = document.getElementById('events-feed');
    if (!feed) return;
    const icons = { goal: '⚽', save: '🧤', yellow: '🟨', red: '🟥', sub: '🔄', injury: '🩹', corner: '🚩', foul: '💢', shot: '👟', miss: '😮', pass: '➡️', offside: '🚫', whistle: '📢', pressure: '🔥', motm: '⭐' };
    const div = document.createElement('div');
    div.className = 'event-item' + (isGoal || type === 'goal' ? ' event-goal' : '') + (type === 'red' ? ' event-card-red' : '') + (type === 'injury' ? ' event-injury' : '');
    div.innerHTML = `<span class="event-time">${minute}'</span><span class="event-icon">${icons[type] || '•'}</span><span class="event-text">${text}</span>`;
    feed.insertBefore(div, feed.firstChild);
  }

  function updateScoreboard() {
    if (!currentMatch) return;
    const m = currentMatch;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('live-home-flag', m.home.team.flag || '');
    set('live-home-name', m.home.team.name);
    set('live-home-form', (FORMATIONS[m.home.squad.formation] || {}).name || '');
    set('live-away-flag', m.away.team.flag || '');
    set('live-away-name', m.away.team.name);
    set('live-away-form', (FORMATIONS[m.away.squad.formation] || {}).name || '');
    set('live-home-score', m.home.score);
    set('live-away-score', m.away.score);
    set('live-minute', m.minute + "'");
    set('live-status', m.status);
  }

  function updateStatsPanel() {
    if (!currentMatch) return;
    const h = currentMatch.home.stats, a = currentMatch.away.stats;
    const ts = (h.shots + a.shots) || 1, ton = (h.shotsOn + a.shotsOn) || 1;
    const tc = (h.corners + a.corners) || 1, tf = (h.fouls + a.fouls) || 1, tsv = (h.saves + a.saves) || 1;
    const el = document.getElementById('live-stats');
    if (!el) return;
    el.innerHTML = `
      <div class="stat-row"><span class="stat-val">${h.shots}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.shots/ts)*50}%"></div><div class="stat-bar-away" style="width:${(a.shots/ts)*50}%"></div></div><span class="stat-val">${a.shots}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Shots</div>
      <div class="stat-row"><span class="stat-val">${h.shotsOn}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.shotsOn/ton)*50}%"></div><div class="stat-bar-away" style="width:${(a.shotsOn/ton)*50}%"></div></div><span class="stat-val">${a.shotsOn}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">On Target</div>
      <div class="stat-row"><span class="stat-val">${h.possession}%</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${h.possession/2}%"></div><div class="stat-bar-away" style="width:${a.possession/2}%"></div></div><span class="stat-val">${a.possession}%</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Possession</div>
      <div class="stat-row"><span class="stat-val">${h.corners}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.corners/tc)*50}%"></div><div class="stat-bar-away" style="width:${(a.corners/tc)*50}%"></div></div><span class="stat-val">${a.corners}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Corners</div>
      <div class="stat-row"><span class="stat-val">${h.fouls}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.fouls/tf)*50}%"></div><div class="stat-bar-away" style="width:${(a.fouls/tf)*50}%"></div></div><span class="stat-val">${a.fouls}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Fouls</div>
      <div class="stat-row"><span class="stat-val">${h.saves}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${(h.saves/tsv)*50}%"></div><div class="stat-bar-away" style="width:${(a.saves/tsv)*50}%"></div></div><span class="stat-val">${a.saves}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Saves</div>
      <div class="stat-row"><span class="stat-val">${h.yellows}</span><div class="stat-bar-wrap"></div><span class="stat-val">${a.yellows}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted)">Yellow Cards</div>`;
  }

  function renderLineups() {
    if (!currentMatch) return;
    const m = currentMatch;
    const html = (side) => {
      const s = m[side];
      let h = `<div class="lineup-team"><h4>${s.team.flag || ''} ${s.team.name} (${(FORMATIONS[s.squad.formation]||{}).name || ''})</h4><ul class="player-list">`;
      (s.squad.starting || []).forEach(p => {
        const on = (side === 'home' ? m.homeOnPitch : m.awayOnPitch).includes(p.id);
        const inj = m.injuries.includes(p.id);
        h += `<li class="player-item ${inj ? 'injured' : ''}"><span class="player-pos">${p.slot || ''}</span> ${p.name} ${!on && !inj ? '(off)' : ''} ${inj ? '🩹' : ''}<span class="player-ovr">${p.ovr || ''}</span></li>`;
      });
      h += `<li style="margin-top:8px;color:var(--text-muted);font-size:0.8rem">Substitutes</li>`;
      (s.squad.subs || []).forEach(p => {
        const on = (side === 'home' ? m.homeOnPitch : m.awayOnPitch).includes(p.id);
        h += `<li class="player-item sub"><span class="player-pos">${(p.pos||[''])[0]}</span> ${p.name} ${on ? '(on)' : ''}<span class="player-ovr">${p.ovr || ''}</span></li>`;
      });
      return h + '</ul></div>';
    };
    const el = document.getElementById('lineup-display');
    if (el) el.innerHTML = html('home') + html('away');
  }

  function recordStat(type, player, team) {
    if (!player || !team) return;
    if (!stats[type]) stats[type] = {};
    if (!stats[type][player.id]) {
      stats[type][player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0 };
    }
    stats[type][player.id].count++;
  }

  function saveStats() {
    try { localStorage.setItem('apexSimStats', JSON.stringify(stats)); } catch(e) {}
  }
  function loadStats() {
    try {
      const s = localStorage.getItem('apexSimStats');
      if (s) stats = JSON.parse(s);
    } catch(e) {}
  }

  function showLeaderboard(type) {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.lb === type));
    const data = Object.values(stats[type] || {}).sort((a, b) => b.count - a.count).slice(0, 20);
    const el = document.getElementById('leaderboard-content');
    if (!el) return;
    if (!data.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>No ${type} recorded yet. Simulate matches!</p></div>`;
      return;
    }
    const labels = { goals: 'Goals', assists: 'Assists', saves: 'Saves', cleanSheets: 'Clean Sheets', cards: 'Cards', motm: 'MOTM' };
    el.innerHTML = `<table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>${labels[type]||type}</th></tr></thead><tbody>
      ${data.map((p,i) => `<tr><td class="lb-rank">${i+1}</td><td class="lb-player">${p.name}</td><td class="lb-team">${p.team}</td><td style="font-weight:700;color:var(--accent-gold)">${p.count}</td></tr>`).join('')}
    </tbody></table>`;
  }

  function renderTournamentTeamSelect() {
    const pool = tournamentType === 'worldcup' ? (teamsData.national || []) : (teamsData.club || []);
    const el = document.getElementById('tournament-teams');
    if (!el) return;
    el.innerHTML = pool.map(t => `<label class="team-check selected" data-id="${t.id}"><input type="checkbox" value="${t.id}" checked><span>${t.flag || ''} ${t.name}</span></label>`).join('');
    el.querySelectorAll('.team-check').forEach(l => {
      l.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = l.querySelector('input');
          if (cb) cb.checked = !cb.checked;
        }
        const cb = l.querySelector('input');
        l.classList.toggle('selected', cb && cb.checked);
      });
    });
  }

  function selectAllTeams() {
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = true;
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.add('selected');
    });
  }
  function deselectAllTeams() {
    document.querySelectorAll('#tournament-teams input').forEach(cb => {
      cb.checked = false;
      const parent = cb.closest('.team-check');
      if (parent) parent.classList.remove('selected');
    });
  }

  function startTournament() {
    const selected = [...document.querySelectorAll('#tournament-teams input:checked')].map(cb => getTeam(cb.value)).filter(Boolean);
    if (selected.length < 4) { toast('Select at least 4 teams'); return; }
    let teams = shuffleArray([...selected]);
    const groupSize = 4;
    const numGroups = Math.floor(teams.length / groupSize) || 1;
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        name: String.fromCharCode(65 + i),
        teams: teams.slice(i * groupSize, (i + 1) * groupSize).map(t => ({
          team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
        }))
      });
    }
    tournament = { type: tournamentType, groups, knockout: [], stage: 'groups', fixtures: [], champion: null };
    generateGroupFixtures();
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    renderGroups();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Group Stage';
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<p style="color:var(--text-muted)">Knockout bracket appears after groups.</p>';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Round';
  }

  function generateGroupFixtures() {
    tournament.fixtures = [];
    tournament.groups.forEach((g, gi) => {
      const ts = g.teams;
      for (let i = 0; i < ts.length; i++)
        for (let j = i + 1; j < ts.length; j++)
          tournament.fixtures.push({ group: gi, home: ts[i].team.id, away: ts[j].team.id, played: false });
    });
    shuffleArray(tournament.fixtures);
  }

  function renderGroups() {
    const el = document.getElementById('groups-container');
    if (!el || !tournament) return;
    el.innerHTML = tournament.groups.map(g => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      return `<div class="group-card"><h4>Group ${g.name}</h4><table class="group-table"><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
        ${sorted.map(t => `<tr><td>${t.team.flag || ''} ${t.team.short}</td><td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.gf - t.ga}</td><td class="pts">${t.pts}</td></tr>`).join('')}
      </tbody></table></div>`;
    }).join('');
  }

  function simTournamentRound() {
    if (!tournament) return;
    if (tournament.stage === 'groups') {
      const unplayed = tournament.fixtures.filter(f => !f.played);
      if (!unplayed.length) { advanceToKnockout(); return; }
      const batch = unplayed.slice(0, Math.max(2, Math.ceil(unplayed.length / 3)));
      batch.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const result = simQuickMatch(home, away);
        f.played = true; f.homeScore = result.home; f.awayScore = result.away;
        const g = tournament.groups[f.group];
        const ht = g.teams.find(t => t.team.id === f.home);
        const at = g.teams.find(t => t.team.id === f.away);
        if (!ht || !at) return;
        ht.played++; at.played++;
        ht.gf += result.home; ht.ga += result.away;
        at.gf += result.away; at.ga += result.home;
        if (result.home > result.away) { ht.won++; ht.pts += 3; at.lost++; }
        else if (result.away > result.home) { at.won++; at.pts += 3; ht.lost++; }
        else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
      });
      renderGroups();
      const remaining = tournament.fixtures.filter(f => !f.played).length;
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.textContent = remaining ? `Group Stage — ${remaining} matches left` : 'Group Stage Complete';
      if (!remaining) setTimeout(() => advanceToKnockout(), 400);
    } else if (tournament.stage === 'knockout') {
      simKnockoutRound();
    }
  }

  function simAllTournament() {
    if (!tournament) return;
    let safety = 0;
    while (tournament.stage === 'groups' && tournament.fixtures.some(f => !f.played) && safety < 50) {
      simTournamentRound();
      safety++;
    }
    if (tournament.stage === 'groups') advanceToKnockout();
    safety = 0;
    while (tournament.stage === 'knockout' && !tournament.champion && safety < 20) {
      simKnockoutRound();
      safety++;
    }
  }

  function advanceToKnockout() {
    if (!tournament) return;
    const qualifiers = [];
    tournament.groups.forEach(g => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      if (sorted[0]) qualifiers.push(sorted[0].team);
      if (sorted[1]) qualifiers.push(sorted[1].team);
    });
    while (qualifiers.length >= 2 && (qualifiers.length & (qualifiers.length - 1))) qualifiers.pop();
    if (qualifiers.length < 2) { toast('Not enough qualifiers'); return; }
    tournament.stage = 'knockout';
    tournament.knockout = [{ name: getRoundName(qualifiers.length), matches: [] }];
    for (let i = 0; i < qualifiers.length; i += 2) {
      tournament.knockout[0].matches.push({
        home: qualifiers[i], away: qualifiers[i + 1],
        homeScore: null, awayScore: null, winner: null, played: false
      });
    }
    renderBracket();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = tournament.knockout[0].name;
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Knockout Round';
  }

  function getRoundName(n) {
    if (n >= 16) return 'Round of 16';
    if (n === 8) return 'Quarter-finals';
    if (n === 4) return 'Semi-finals';
    if (n === 2) return 'Final';
    return 'Knockout';
  }

  function simKnockoutRound() {
    if (!tournament || !tournament.knockout.length) return;
    const current = tournament.knockout[tournament.knockout.length - 1];
    const unplayed = current.matches.filter(m => !m.played);
    if (!unplayed.length) return;
    unplayed.forEach(m => {
      const result = simQuickMatch(m.home, m.away);
      m.homeScore = result.home;
      m.awayScore = result.away;
      m.played = true;
      if (result.home === result.away) {
        m.winner = Math.random() < 0.5 ? m.home : m.away;
        if (m.winner === m.home) m.homeScore++; else m.awayScore++;
        m.penalties = true;
      } else {
        m.winner = result.home > result.away ? m.home : m.away;
      }
    });
    renderBracket();
    const winners = current.matches.map(m => m.winner).filter(Boolean);
    if (winners.length === 1) {
      tournament.champion = winners[0];
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.textContent = `🏆 Champions: ${winners[0].flag || ''} ${winners[0].name}`;
      toast(`${winners[0].name} win the ${tournament.type === 'worldcup' ? 'World Cup' : 'Champions League'}!`);
      return;
    }
    if (winners.length < 2) return;
    const nextMatches = [];
    for (let i = 0; i < winners.length; i += 2) {
      nextMatches.push({
        home: winners[i], away: winners[i + 1],
        homeScore: null, awayScore: null, winner: null, played: false
      });
    }
    tournament.knockout.push({ name: getRoundName(winners.length), matches: nextMatches });
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = getRoundName(winners.length);
    renderBracket();
  }

  function simQuickMatch(homeTeam, awayTeam) {
    const homeSquad = buildSquad(homeTeam, '4-3-3');
    const awaySquad = buildSquad(awayTeam, '4-3-3');
    const homeStr = homeSquad.starting.reduce((s, p) => s + (p.att || 70) + (p.ovr || 70), 0) / Math.max(1, homeSquad.starting.length);
    const awayStr = awaySquad.starting.reduce((s, p) => s + (p.att || 70) + (p.ovr || 70), 0) / Math.max(1, awaySquad.starting.length);
    const homeExp = (homeStr / (homeStr + awayStr)) * 2.4;
    const awayExp = (awayStr / (homeStr + awayStr)) * 2.4;
    const homeGoals = poisson(homeExp);
    const awayGoals = poisson(awayExp);
    for (let i = 0; i < homeGoals; i++) {
      const attackers = homeSquad.starting.filter(p => !(p.pos || []).includes('GK')).sort((a, b) => (b.att || 0) - (a.att || 0));
      const scorer = attackers[Math.floor(Math.random() * Math.min(3, attackers.length))] || homeSquad.starting[10];
      if (scorer) recordStat('goals', scorer, homeTeam);
      if (Math.random() < 0.65) {
        const ast = homeSquad.starting[Math.floor(Math.random() * 8) + 1];
        if (ast && scorer && ast.id !== scorer.id) recordStat('assists', ast, homeTeam);
      }
    }
    for (let i = 0; i < awayGoals; i++) {
      const attackers = awaySquad.starting.filter(p => !(p.pos || []).includes('GK')).sort((a, b) => (b.att || 0) - (a.att || 0));
      const scorer = attackers[Math.floor(Math.random() * Math.min(3, attackers.length))] || awaySquad.starting[10];
      if (scorer) recordStat('goals', scorer, awayTeam);
      if (Math.random() < 0.65) {
        const ast = awaySquad.starting[Math.floor(Math.random() * 8) + 1];
        if (ast && scorer && ast.id !== scorer.id) recordStat('assists', ast, awayTeam);
      }
    }
    if (awayGoals === 0) {
      const gk = homeSquad.starting.find(p => (p.pos || []).includes('GK'));
      if (gk) recordStat('cleanSheets', gk, homeTeam);
    }
    if (homeGoals === 0) {
      const gk = awaySquad.starting.find(p => (p.pos || []).includes('GK'));
      if (gk) recordStat('cleanSheets', gk, awayTeam);
    }
    const homeGk = homeSquad.starting.find(p => (p.pos || []).includes('GK'));
    const awayGk = awaySquad.starting.find(p => (p.pos || []).includes('GK'));
    if (homeGk) for (let i = 0; i < Math.floor(Math.random() * 4) + awayGoals; i++) recordStat('saves', homeGk, homeTeam);
    if (awayGk) for (let i = 0; i < Math.floor(Math.random() * 4) + homeGoals; i++) recordStat('saves', awayGk, awayTeam);
    saveStats();
    return { home: homeGoals, away: awayGoals };
  }

  function poisson(lambda) {
    const L = Math.exp(-Math.max(0.1, lambda));
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L && k < 10);
    return k - 1;
  }

  function renderBracket() {
    const el = document.getElementById('bracket');
    if (!el || !tournament) return;
    if (!tournament.knockout.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">No knockout matches yet.</p>';
      return;
    }
    el.innerHTML = tournament.knockout.map(round => `
      <div class="round"><div class="round-title">${round.name}</div>
      ${round.matches.map(m => `
        <div class="bracket-match ${m.played ? 'played' : ''}">
          <div class="bracket-team ${m.winner && m.winner.id === m.home.id ? 'winner' : ''}">
            <span>${m.home.flag || ''} ${m.home.short}</span>
            <span class="bracket-score">${m.played ? m.homeScore : '-'}</span>
          </div>
          <div class="bracket-team ${m.winner && m.winner.id === m.away.id ? 'winner' : ''}">
            <span>${m.away.flag || ''} ${m.away.short}</span>
            <span class="bracket-score">${m.played ? m.awayScore : '-'}</span>
          </div>
          ${m.penalties ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">pens</div>' : ''}
        </div>`).join('')}
      </div>`).join('');
  }

  function resetTournament() {
    tournament = null;
    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Round';
  }

  function filterTeams(type) { renderTeamsList(type); }

  function renderTeamsList(filter) {
    filter = filter || 'all';
    let list = allTeams;
    if (filter === 'national') list = teamsData.national || [];
    if (filter === 'club') list = teamsData.club || [];
    const el = document.getElementById('teams-list');
    if (!el) return;
    el.innerHTML = list.map(t => `
      <div class="team-check" style="cursor:default;flex-direction:column;align-items:flex-start;gap:4px">
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:1.5rem">${t.flag || ''}</span><strong>${t.name}</strong></div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${(t.players || []).length} players · ${t.short}</div>
      </div>`).join('');
  }

  function toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  return {
    init, switchView, goToMatch, goToTournament, updateTeamPreview,
    startMatch, quickSimMatch, toggleSim, setSpeed, simToEnd, resetMatch,
    showLeaderboard, selectAllTeams, deselectAllTeams, startTournament,
    simTournamentRound, simAllTournament, resetTournament, filterTeams
  };
})();

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
