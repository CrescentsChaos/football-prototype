/* Apex Football Simulator - Fixed (no external fetch) */
const App = (() => {
  // ========== EMBEDDED TEAMS DATA ==========
  const TEAMS_DATA = {"national": [{"id": "bra", "name": "Brazil", "short": "BRA", "flag": "🇧🇷", "color": "#009c3b", "secondary": "#ffdf00", "players": [{"id": "bra1", "name": "Alisson", "pos": ["GK"], "ovr": 89, "att": 20, "def": 88, "phy": 85, "pac": 60, "tec": 70, "num": 1}, {"id": "bra2", "name": "Ederson", "pos": ["GK"], "ovr": 88, "att": 25, "def": 86, "phy": 84, "pac": 65, "tec": 75, "num": 12}, {"id": "bra3", "name": "Marquinhos", "pos": ["CB"], "ovr": 87, "att": 50, "def": 90, "phy": 85, "pac": 78, "tec": 75, "num": 2}, {"id": "bra4", "name": "Thiago Silva", "pos": ["CB"], "ovr": 84, "att": 45, "def": 88, "phy": 80, "pac": 60, "tec": 78, "num": 3}, {"id": "bra5", "name": "Militão", "pos": ["CB", "RB"], "ovr": 86, "att": 55, "def": 87, "phy": 86, "pac": 85, "tec": 72, "num": 4}, {"id": "bra6", "name": "Bremer", "pos": ["CB"], "ovr": 85, "att": 48, "def": 86, "phy": 88, "pac": 78, "tec": 70, "num": 5}, {"id": "bra7", "name": "Danilo", "pos": ["RB", "CB"], "ovr": 82, "att": 60, "def": 82, "phy": 80, "pac": 75, "tec": 78, "num": 22}, {"id": "bra8", "name": "Alex Sandro", "pos": ["LB"], "ovr": 81, "att": 65, "def": 80, "phy": 78, "pac": 80, "tec": 80, "num": 6}, {"id": "bra9", "name": "Carlos Augusto", "pos": ["LB", "LM"], "ovr": 80, "att": 68, "def": 78, "phy": 76, "pac": 82, "tec": 78, "num": 7}, {"id": "bra10", "name": "Casemiro", "pos": ["CDM", "CM"], "ovr": 87, "att": 70, "def": 88, "phy": 88, "pac": 65, "tec": 80, "num": 8}, {"id": "bra11", "name": "Bruno Guimarães", "pos": ["CM", "CDM"], "ovr": 85, "att": 75, "def": 80, "phy": 82, "pac": 75, "tec": 85, "num": 10}, {"id": "bra12", "name": "André", "pos": ["CDM", "CM"], "ovr": 82, "att": 65, "def": 83, "phy": 80, "pac": 78, "tec": 80, "num": 14}, {"id": "bra13", "name": "Paquetá", "pos": ["CM", "CAM"], "ovr": 84, "att": 82, "def": 70, "phy": 78, "pac": 78, "tec": 88, "num": 16}, {"id": "bra14", "name": "Joelinton", "pos": ["CM", "LW", "ST"], "ovr": 83, "att": 80, "def": 75, "phy": 88, "pac": 80, "tec": 78, "num": 18}, {"id": "bra15", "name": "Rodrygo", "pos": ["RW", "ST", "LW"], "ovr": 86, "att": 88, "def": 40, "phy": 70, "pac": 90, "tec": 88, "num": 11}, {"id": "bra16", "name": "Vinícius Jr", "pos": ["LW", "ST"], "ovr": 90, "att": 92, "def": 35, "phy": 75, "pac": 95, "tec": 90, "num": 17}, {"id": "bra17", "name": "Raphinha", "pos": ["RW", "LW"], "ovr": 84, "att": 85, "def": 45, "phy": 72, "pac": 88, "tec": 85, "num": 19}, {"id": "bra18", "name": "Endrick", "pos": ["ST", "RW"], "ovr": 81, "att": 84, "def": 30, "phy": 78, "pac": 88, "tec": 80, "num": 9}, {"id": "bra19", "name": "Richarlison", "pos": ["ST", "LW"], "ovr": 82, "att": 85, "def": 40, "phy": 85, "pac": 82, "tec": 78, "num": 21}, {"id": "bra20", "name": "Gabriel Jesus", "pos": ["ST", "RW"], "ovr": 82, "att": 84, "def": 45, "phy": 78, "pac": 85, "tec": 84, "num": 13}, {"id": "bra21", "name": "Neymar", "pos": ["LW", "CAM", "ST"], "ovr": 87, "att": 90, "def": 35, "phy": 70, "pac": 85, "tec": 94, "num": 20}, {"id": "bra22", "name": "Martinelli", "pos": ["LW", "RW"], "ovr": 83, "att": 84, "def": 40, "phy": 72, "pac": 90, "tec": 82, "num": 15}, {"id": "bra23", "name": "Douglas Luiz", "pos": ["CM", "CDM"], "ovr": 81, "att": 72, "def": 78, "phy": 78, "pac": 75, "tec": 82, "num": 23}, {"id": "bra24", "name": "Savinho", "pos": ["RW", "LW"], "ovr": 80, "att": 82, "def": 35, "phy": 68, "pac": 90, "tec": 84, "num": 24}, {"id": "bra25", "name": "Andreas Pereira", "pos": ["CAM", "CM"], "ovr": 79, "att": 78, "def": 55, "phy": 70, "pac": 78, "tec": 82, "num": 25}, {"id": "bra26", "name": "Weverton", "pos": ["GK"], "ovr": 80, "att": 15, "def": 80, "phy": 78, "pac": 55, "tec": 65, "num": 26}, {"id": "bra27", "name": "Beraldo", "pos": ["CB"], "ovr": 78, "att": 40, "def": 80, "phy": 78, "pac": 75, "tec": 70, "num": 27}, {"id": "bra28", "name": "Yan Couto", "pos": ["RB", "RW"], "ovr": 79, "att": 70, "def": 72, "phy": 70, "pac": 88, "tec": 78, "num": 28}], "manager": {"name": "Dorival Júnior", "ovr": 82}}, {"id": "arg", "name": "Argentina", "short": "ARG", "flag": "🇦🇷", "color": "#75aadb", "secondary": "#ffffff", "players": [{"id": "arg1", "name": "Emiliano Martínez", "pos": ["GK"], "ovr": 88, "att": 20, "def": 87, "phy": 85, "pac": 55, "tec": 70, "num": 1}, {"id": "arg2", "name": "Armani", "pos": ["GK"], "ovr": 80, "att": 15, "def": 80, "phy": 78, "pac": 50, "tec": 65, "num": 12}, {"id": "arg3", "name": "Cuti Romero", "pos": ["CB"], "ovr": 86, "att": 50, "def": 88, "phy": 86, "pac": 80, "tec": 70, "num": 2}, {"id": "arg4", "name": "Lisandro Martínez", "pos": ["CB", "LB"], "ovr": 85, "att": 55, "def": 87, "phy": 82, "pac": 75, "tec": 78, "num": 3}, {"id": "arg5", "name": "Otamendi", "pos": ["CB"], "ovr": 82, "att": 45, "def": 85, "phy": 82, "pac": 60, "tec": 72, "num": 4}, {"id": "arg6", "name": "Molina", "pos": ["RB"], "ovr": 83, "att": 70, "def": 80, "phy": 78, "pac": 85, "tec": 78, "num": 22}, {"id": "arg7", "name": "Tagliafico", "pos": ["LB"], "ovr": 81, "att": 65, "def": 80, "phy": 78, "pac": 80, "tec": 75, "num": 5}, {"id": "arg8", "name": "Acuña", "pos": ["LB", "LM"], "ovr": 82, "att": 72, "def": 78, "phy": 80, "pac": 82, "tec": 80, "num": 6}, {"id": "arg9", "name": "De Paul", "pos": ["CM", "RM"], "ovr": 85, "att": 80, "def": 75, "phy": 82, "pac": 78, "tec": 85, "num": 8}, {"id": "arg10", "name": "Mac Allister", "pos": ["CM", "CAM"], "ovr": 84, "att": 80, "def": 72, "phy": 78, "pac": 75, "tec": 86, "num": 10}, {"id": "arg11", "name": "Enzo Fernández", "pos": ["CM", "CDM"], "ovr": 84, "att": 78, "def": 78, "phy": 80, "pac": 75, "tec": 85, "num": 14}, {"id": "arg12", "name": "Paredes", "pos": ["CDM", "CM"], "ovr": 81, "att": 70, "def": 82, "phy": 78, "pac": 65, "tec": 82, "num": 15}, {"id": "arg13", "name": "Lo Celso", "pos": ["CAM", "CM"], "ovr": 81, "att": 80, "def": 55, "phy": 70, "pac": 78, "tec": 85, "num": 7}, {"id": "arg14", "name": "Messi", "pos": ["RW", "CAM", "ST"], "ovr": 90, "att": 92, "def": 35, "phy": 68, "pac": 82, "tec": 95, "num": 11}, {"id": "arg15", "name": "Álvarez", "pos": ["ST", "LW"], "ovr": 85, "att": 88, "def": 40, "phy": 78, "pac": 88, "tec": 84, "num": 9}, {"id": "arg16", "name": "Lautaro", "pos": ["ST"], "ovr": 87, "att": 90, "def": 35, "phy": 82, "pac": 82, "tec": 85, "num": 19}, {"id": "arg17", "name": "Di María", "pos": ["RW", "LW", "CAM"], "ovr": 84, "att": 85, "def": 40, "phy": 70, "pac": 82, "tec": 88, "num": 17}, {"id": "arg18", "name": "Dybala", "pos": ["CAM", "ST", "RW"], "ovr": 85, "att": 88, "def": 35, "phy": 68, "pac": 80, "tec": 90, "num": 20}, {"id": "arg19", "name": "Garnacho", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 90, "tec": 80, "num": 13}, {"id": "arg20", "name": "Thiago Almada", "pos": ["CAM", "LW"], "ovr": 80, "att": 82, "def": 40, "phy": 68, "pac": 85, "tec": 84, "num": 16}, {"id": "arg21", "name": "Palacios", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 78, "phy": 78, "pac": 78, "tec": 80, "num": 18}, {"id": "arg22", "name": "Montiel", "pos": ["RB"], "ovr": 79, "att": 65, "def": 78, "phy": 80, "pac": 82, "tec": 72, "num": 21}, {"id": "arg23", "name": "Pezzella", "pos": ["CB"], "ovr": 78, "att": 40, "def": 80, "phy": 80, "pac": 60, "tec": 68, "num": 23}, {"id": "arg24", "name": "Rulli", "pos": ["GK"], "ovr": 79, "att": 18, "def": 79, "phy": 78, "pac": 55, "tec": 68, "num": 24}, {"id": "arg25", "name": "Gonzalo Montiel", "pos": ["RB"], "ovr": 78, "att": 62, "def": 76, "phy": 78, "pac": 80, "tec": 72, "num": 25}], "manager": {"name": "Lionel Scaloni", "ovr": 88}}, {"id": "fra", "name": "France", "short": "FRA", "flag": "🇫🇷", "color": "#002654", "secondary": "#ed2939", "players": [{"id": "fra1", "name": "Lloris", "pos": ["GK"], "ovr": 84, "att": 15, "def": 84, "phy": 80, "pac": 50, "tec": 70, "num": 1}, {"id": "fra2", "name": "Maignan", "pos": ["GK"], "ovr": 87, "att": 25, "def": 86, "phy": 84, "pac": 60, "tec": 75, "num": 12}, {"id": "fra3", "name": "Upamecano", "pos": ["CB"], "ovr": 84, "att": 50, "def": 85, "phy": 88, "pac": 82, "tec": 70, "num": 2}, {"id": "fra4", "name": "Saliba", "pos": ["CB"], "ovr": 87, "att": 45, "def": 88, "phy": 85, "pac": 80, "tec": 75, "num": 3}, {"id": "fra5", "name": "Konaté", "pos": ["CB"], "ovr": 84, "att": 48, "def": 85, "phy": 88, "pac": 80, "tec": 70, "num": 4}, {"id": "fra6", "name": "Hernández", "pos": ["LB"], "ovr": 85, "att": 75, "def": 82, "phy": 80, "pac": 88, "tec": 80, "num": 5}, {"id": "fra7", "name": "Koundé", "pos": ["RB", "CB"], "ovr": 85, "att": 65, "def": 85, "phy": 82, "pac": 85, "tec": 78, "num": 22}, {"id": "fra8", "name": "Tchouaméni", "pos": ["CDM", "CM"], "ovr": 85, "att": 70, "def": 85, "phy": 86, "pac": 75, "tec": 80, "num": 6}, {"id": "fra9", "name": "Camavinga", "pos": ["CM", "LB", "CDM"], "ovr": 84, "att": 72, "def": 80, "phy": 82, "pac": 85, "tec": 82, "num": 8}, {"id": "fra10", "name": "Rabiot", "pos": ["CM", "LM"], "ovr": 83, "att": 78, "def": 78, "phy": 85, "pac": 75, "tec": 80, "num": 10}, {"id": "fra11", "name": "Griezmann", "pos": ["CAM", "ST", "RW"], "ovr": 87, "att": 88, "def": 55, "phy": 75, "pac": 80, "tec": 90, "num": 7}, {"id": "fra12", "name": "Mbappé", "pos": ["ST", "LW"], "ovr": 91, "att": 93, "def": 35, "phy": 80, "pac": 97, "tec": 88, "num": 9}, {"id": "fra13", "name": "Dembélé", "pos": ["RW", "LW"], "ovr": 85, "att": 86, "def": 35, "phy": 70, "pac": 92, "tec": 88, "num": 11}, {"id": "fra14", "name": "Coman", "pos": ["LW", "RW"], "ovr": 84, "att": 85, "def": 35, "phy": 72, "pac": 92, "tec": 85, "num": 17}, {"id": "fra15", "name": "Giroud", "pos": ["ST"], "ovr": 82, "att": 85, "def": 40, "phy": 82, "pac": 60, "tec": 80, "num": 19}, {"id": "fra16", "name": "Thuram", "pos": ["ST", "RW"], "ovr": 84, "att": 86, "def": 40, "phy": 85, "pac": 88, "tec": 80, "num": 21}, {"id": "fra17", "name": "Fofana", "pos": ["CM", "CDM"], "ovr": 81, "att": 70, "def": 80, "phy": 82, "pac": 80, "tec": 78, "num": 14}, {"id": "fra18", "name": "Zaire-Emery", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 75, "phy": 75, "pac": 82, "tec": 82, "num": 16}, {"id": "fra19", "name": "Barcola", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 90, "tec": 82, "num": 20}, {"id": "fra20", "name": "Pavard", "pos": ["RB", "CB"], "ovr": 81, "att": 60, "def": 82, "phy": 80, "pac": 75, "tec": 75, "num": 13}, {"id": "fra21", "name": "Clauss", "pos": ["RB", "RM"], "ovr": 80, "att": 72, "def": 75, "phy": 75, "pac": 85, "tec": 78, "num": 15}, {"id": "fra22", "name": "Areola", "pos": ["GK"], "ovr": 81, "att": 18, "def": 81, "phy": 78, "pac": 55, "tec": 68, "num": 23}, {"id": "fra23", "name": "Disasi", "pos": ["CB"], "ovr": 79, "att": 45, "def": 80, "phy": 85, "pac": 72, "tec": 68, "num": 18}, {"id": "fra24", "name": "Guendouzi", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 75, "phy": 80, "pac": 78, "tec": 80, "num": 24}, {"id": "fra25", "name": "Kolo Muani", "pos": ["ST", "RW"], "ovr": 81, "att": 83, "def": 35, "phy": 80, "pac": 88, "tec": 78, "num": 25}], "manager": {"name": "Didier Deschamps", "ovr": 86}}, {"id": "eng", "name": "England", "short": "ENG", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "color": "#ffffff", "secondary": "#cf081f", "players": [{"id": "eng1", "name": "Pickford", "pos": ["GK"], "ovr": 83, "att": 20, "def": 83, "phy": 80, "pac": 55, "tec": 70, "num": 1}, {"id": "eng2", "name": "Ramsdale", "pos": ["GK"], "ovr": 81, "att": 18, "def": 81, "phy": 78, "pac": 55, "tec": 68, "num": 12}, {"id": "eng3", "name": "Stones", "pos": ["CB"], "ovr": 85, "att": 55, "def": 86, "phy": 82, "pac": 72, "tec": 80, "num": 2}, {"id": "eng4", "name": "Walker", "pos": ["RB", "CB"], "ovr": 84, "att": 60, "def": 82, "phy": 80, "pac": 90, "tec": 75, "num": 4}, {"id": "eng5", "name": "Guehi", "pos": ["CB"], "ovr": 82, "att": 45, "def": 84, "phy": 82, "pac": 75, "tec": 72, "num": 3}, {"id": "eng6", "name": "Dunk", "pos": ["CB"], "ovr": 80, "att": 40, "def": 82, "phy": 82, "pac": 55, "tec": 68, "num": 5}, {"id": "eng7", "name": "Shaw", "pos": ["LB"], "ovr": 82, "att": 70, "def": 80, "phy": 78, "pac": 80, "tec": 80, "num": 6}, {"id": "eng8", "name": "Trippier", "pos": ["RB", "RM"], "ovr": 83, "att": 75, "def": 80, "phy": 75, "pac": 75, "tec": 85, "num": 22}, {"id": "eng9", "name": "Rice", "pos": ["CDM", "CM"], "ovr": 87, "att": 70, "def": 88, "phy": 88, "pac": 75, "tec": 80, "num": 8}, {"id": "eng10", "name": "Bellingham", "pos": ["CM", "CAM"], "ovr": 88, "att": 85, "def": 75, "phy": 85, "pac": 82, "tec": 88, "num": 10}, {"id": "eng11", "name": "Foden", "pos": ["CAM", "RW", "LW"], "ovr": 87, "att": 88, "def": 50, "phy": 72, "pac": 85, "tec": 90, "num": 7}, {"id": "eng12", "name": "Saka", "pos": ["RW", "RM"], "ovr": 87, "att": 88, "def": 50, "phy": 75, "pac": 90, "tec": 88, "num": 11}, {"id": "eng13", "name": "Kane", "pos": ["ST"], "ovr": 89, "att": 92, "def": 45, "phy": 82, "pac": 70, "tec": 88, "num": 9}, {"id": "eng14", "name": "Rashford", "pos": ["LW", "ST"], "ovr": 84, "att": 86, "def": 35, "phy": 78, "pac": 90, "tec": 82, "num": 17}, {"id": "eng15", "name": "Grealish", "pos": ["LW", "CAM"], "ovr": 83, "att": 84, "def": 45, "phy": 72, "pac": 78, "tec": 88, "num": 20}, {"id": "eng16", "name": "Palmer", "pos": ["CAM", "RW"], "ovr": 84, "att": 86, "def": 40, "phy": 70, "pac": 82, "tec": 88, "num": 13}, {"id": "eng17", "name": "Gordon", "pos": ["LW", "RW"], "ovr": 82, "att": 84, "def": 40, "phy": 75, "pac": 88, "tec": 80, "num": 14}, {"id": "eng18", "name": "Gallagher", "pos": ["CM"], "ovr": 80, "att": 75, "def": 75, "phy": 82, "pac": 80, "tec": 78, "num": 16}, {"id": "eng19", "name": "Mainoo", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 75, "phy": 78, "pac": 80, "tec": 82, "num": 18}, {"id": "eng20", "name": "Alexander-Arnold", "pos": ["RB", "CM"], "ovr": 86, "att": 80, "def": 78, "phy": 75, "pac": 80, "tec": 90, "num": 15}, {"id": "eng21", "name": "Maguire", "pos": ["CB"], "ovr": 80, "att": 50, "def": 82, "phy": 85, "pac": 50, "tec": 70, "num": 19}, {"id": "eng22", "name": "Pope", "pos": ["GK"], "ovr": 82, "att": 15, "def": 82, "phy": 80, "pac": 50, "tec": 68, "num": 23}, {"id": "eng23", "name": "Eze", "pos": ["CAM", "LW"], "ovr": 82, "att": 84, "def": 45, "phy": 72, "pac": 82, "tec": 86, "num": 21}, {"id": "eng24", "name": "Watkins", "pos": ["ST"], "ovr": 83, "att": 85, "def": 35, "phy": 82, "pac": 85, "tec": 78, "num": 24}, {"id": "eng25", "name": "Toney", "pos": ["ST"], "ovr": 81, "att": 84, "def": 40, "phy": 82, "pac": 75, "tec": 78, "num": 25}], "manager": {"name": "Thomas Tuchel", "ovr": 85}}, {"id": "ger", "name": "Germany", "short": "GER", "flag": "🇩🇪", "color": "#000000", "secondary": "#dd0000", "players": [{"id": "ger1", "name": "Neuer", "pos": ["GK"], "ovr": 86, "att": 30, "def": 85, "phy": 82, "pac": 55, "tec": 80, "num": 1}, {"id": "ger2", "name": "ter Stegen", "pos": ["GK"], "ovr": 88, "att": 25, "def": 87, "phy": 82, "pac": 55, "tec": 78, "num": 12}, {"id": "ger3", "name": "Rüdiger", "pos": ["CB"], "ovr": 86, "att": 50, "def": 87, "phy": 90, "pac": 80, "tec": 70, "num": 2}, {"id": "ger4", "name": "Tah", "pos": ["CB"], "ovr": 84, "att": 45, "def": 85, "phy": 88, "pac": 70, "tec": 72, "num": 3}, {"id": "ger5", "name": "Schlotterbeck", "pos": ["CB"], "ovr": 83, "att": 55, "def": 84, "phy": 85, "pac": 80, "tec": 75, "num": 4}, {"id": "ger6", "name": "Raum", "pos": ["LB"], "ovr": 82, "att": 75, "def": 78, "phy": 78, "pac": 88, "tec": 80, "num": 5}, {"id": "ger7", "name": "Kimmich", "pos": ["CDM", "RB", "CM"], "ovr": 87, "att": 78, "def": 85, "phy": 80, "pac": 75, "tec": 88, "num": 6}, {"id": "ger8", "name": "Goretzka", "pos": ["CM", "CDM"], "ovr": 85, "att": 80, "def": 80, "phy": 88, "pac": 78, "tec": 82, "num": 8}, {"id": "ger9", "name": "Musiala", "pos": ["CAM", "CM", "LW"], "ovr": 87, "att": 88, "def": 50, "phy": 72, "pac": 85, "tec": 92, "num": 10}, {"id": "ger10", "name": "Wirtz", "pos": ["CAM", "CM"], "ovr": 88, "att": 88, "def": 45, "phy": 70, "pac": 85, "tec": 92, "num": 7}, {"id": "ger11", "name": "Sané", "pos": ["RW", "LW"], "ovr": 84, "att": 85, "def": 35, "phy": 72, "pac": 92, "tec": 85, "num": 11}, {"id": "ger12", "name": "Gnabry", "pos": ["RW", "ST"], "ovr": 83, "att": 84, "def": 40, "phy": 75, "pac": 85, "tec": 84, "num": 17}, {"id": "ger13", "name": "Havertz", "pos": ["ST", "CAM", "CM"], "ovr": 84, "att": 85, "def": 55, "phy": 80, "pac": 80, "tec": 84, "num": 9}, {"id": "ger14", "name": "Füllkrug", "pos": ["ST"], "ovr": 82, "att": 84, "def": 40, "phy": 85, "pac": 65, "tec": 78, "num": 19}, {"id": "ger15", "name": "Müller", "pos": ["CAM", "ST", "RW"], "ovr": 83, "att": 85, "def": 50, "phy": 72, "pac": 70, "tec": 88, "num": 20}, {"id": "ger16", "name": "Gündoğan", "pos": ["CM", "CAM"], "ovr": 84, "att": 82, "def": 70, "phy": 75, "pac": 70, "tec": 88, "num": 14}, {"id": "ger17", "name": "Andrich", "pos": ["CDM", "CM"], "ovr": 81, "att": 70, "def": 82, "phy": 85, "pac": 70, "tec": 75, "num": 15}, {"id": "ger18", "name": "Mittelstädt", "pos": ["LB"], "ovr": 80, "att": 68, "def": 78, "phy": 78, "pac": 82, "tec": 75, "num": 13}, {"id": "ger19", "name": "Henrichs", "pos": ["RB", "RM"], "ovr": 80, "att": 70, "def": 78, "phy": 78, "pac": 82, "tec": 78, "num": 22}, {"id": "ger20", "name": "Beier", "pos": ["ST", "RW"], "ovr": 79, "att": 82, "def": 35, "phy": 75, "pac": 85, "tec": 78, "num": 21}, {"id": "ger21", "name": "Nübel", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68, "num": 23}, {"id": "ger22", "name": "Koch", "pos": ["CB"], "ovr": 79, "att": 45, "def": 80, "phy": 82, "pac": 70, "tec": 70, "num": 16}, {"id": "ger23", "name": "Groß", "pos": ["CM", "CDM"], "ovr": 80, "att": 75, "def": 75, "phy": 75, "pac": 70, "tec": 82, "num": 18}, {"id": "ger24", "name": "Undav", "pos": ["ST"], "ovr": 80, "att": 82, "def": 35, "phy": 80, "pac": 78, "tec": 78, "num": 24}, {"id": "ger25", "name": "Adeyemi", "pos": ["LW", "RW"], "ovr": 81, "att": 82, "def": 35, "phy": 75, "pac": 95, "tec": 78, "num": 25}], "manager": {"name": "Julian Nagelsmann", "ovr": 84}}, {"id": "esp", "name": "Spain", "short": "ESP", "flag": "🇪🇸", "color": "#aa151b", "secondary": "#f1bf00", "players": [{"id": "esp1", "name": "Unai Simón", "pos": ["GK"], "ovr": 84, "att": 18, "def": 84, "phy": 80, "pac": 55, "tec": 70, "num": 1}, {"id": "esp2", "name": "Raya", "pos": ["GK"], "ovr": 83, "att": 20, "def": 83, "phy": 78, "pac": 55, "tec": 72, "num": 12}, {"id": "esp3", "name": "Carvajal", "pos": ["RB"], "ovr": 85, "att": 70, "def": 84, "phy": 80, "pac": 80, "tec": 82, "num": 2}, {"id": "esp4", "name": "Le Normand", "pos": ["CB"], "ovr": 82, "att": 40, "def": 84, "phy": 82, "pac": 70, "tec": 70, "num": 3}, {"id": "esp5", "name": "Laporte", "pos": ["CB"], "ovr": 84, "att": 50, "def": 85, "phy": 82, "pac": 70, "tec": 78, "num": 4}, {"id": "esp6", "name": "Cubarsí", "pos": ["CB"], "ovr": 80, "att": 45, "def": 82, "phy": 75, "pac": 75, "tec": 78, "num": 5}, {"id": "esp7", "name": "Balde", "pos": ["LB"], "ovr": 83, "att": 72, "def": 78, "phy": 75, "pac": 92, "tec": 80, "num": 6}, {"id": "esp8", "name": "Rodri", "pos": ["CDM", "CM"], "ovr": 90, "att": 75, "def": 90, "phy": 85, "pac": 70, "tec": 88, "num": 8}, {"id": "esp9", "name": "Pedri", "pos": ["CM", "CAM"], "ovr": 86, "att": 80, "def": 70, "phy": 70, "pac": 80, "tec": 92, "num": 10}, {"id": "esp10", "name": "Gavi", "pos": ["CM", "LW"], "ovr": 84, "att": 78, "def": 72, "phy": 75, "pac": 82, "tec": 88, "num": 14}, {"id": "esp11", "name": "Olmo", "pos": ["CAM", "LW"], "ovr": 84, "att": 85, "def": 50, "phy": 72, "pac": 82, "tec": 88, "num": 7}, {"id": "esp12", "name": "Fabián", "pos": ["CM", "CDM"], "ovr": 83, "att": 78, "def": 78, "phy": 80, "pac": 78, "tec": 84, "num": 16}, {"id": "esp13", "name": "Williams", "pos": ["RW", "LW"], "ovr": 84, "att": 86, "def": 35, "phy": 78, "pac": 92, "tec": 82, "num": 11}, {"id": "esp14", "name": "Yamal", "pos": ["RW"], "ovr": 85, "att": 86, "def": 35, "phy": 65, "pac": 88, "tec": 90, "num": 17}, {"id": "esp15", "name": "Morata", "pos": ["ST"], "ovr": 83, "att": 85, "def": 40, "phy": 80, "pac": 80, "tec": 80, "num": 9}, {"id": "esp16", "name": "Oyarzabal", "pos": ["ST", "LW"], "ovr": 84, "att": 86, "def": 40, "phy": 78, "pac": 80, "tec": 84, "num": 19}, {"id": "esp17", "name": "Joselu", "pos": ["ST"], "ovr": 80, "att": 82, "def": 35, "phy": 82, "pac": 60, "tec": 75, "num": 21}, {"id": "esp18", "name": "Merino", "pos": ["CM", "CAM"], "ovr": 82, "att": 78, "def": 75, "phy": 82, "pac": 75, "tec": 82, "num": 18}, {"id": "esp19", "name": "Zubimendi", "pos": ["CDM", "CM"], "ovr": 82, "att": 70, "def": 82, "phy": 78, "pac": 72, "tec": 84, "num": 15}, {"id": "esp20", "name": "Grimaldo", "pos": ["LB", "LM"], "ovr": 85, "att": 80, "def": 78, "phy": 75, "pac": 85, "tec": 88, "num": 13}, {"id": "esp21", "name": "Navas", "pos": ["RB"], "ovr": 80, "att": 65, "def": 80, "phy": 72, "pac": 75, "tec": 80, "num": 22}, {"id": "esp22", "name": "Remiro", "pos": ["GK"], "ovr": 80, "att": 15, "def": 80, "phy": 78, "pac": 50, "tec": 68, "num": 23}, {"id": "esp23", "name": "Vivian", "pos": ["CB"], "ovr": 79, "att": 40, "def": 80, "phy": 80, "pac": 70, "tec": 70, "num": 20}, {"id": "esp24", "name": "Baena", "pos": ["CAM", "LW"], "ovr": 80, "att": 82, "def": 45, "phy": 70, "pac": 82, "tec": 84, "num": 24}, {"id": "esp25", "name": "Ferran", "pos": ["ST", "LW"], "ovr": 81, "att": 83, "def": 35, "phy": 75, "pac": 85, "tec": 80, "num": 25}], "manager": {"name": "Luis de la Fuente", "ovr": 83}}, {"id": "por", "name": "Portugal", "short": "POR", "flag": "🇵🇹", "color": "#006600", "secondary": "#ff0000", "players": [{"id": "por1", "name": "Costa", "pos": ["GK"], "ovr": 85, "att": 18, "def": 85, "phy": 82, "pac": 55, "tec": 70, "num": 1}, {"id": "por2", "name": "Sá", "pos": ["GK"], "ovr": 82, "att": 18, "def": 82, "phy": 80, "pac": 55, "tec": 68, "num": 12}, {"id": "por3", "name": "Dias", "pos": ["CB"], "ovr": 88, "att": 50, "def": 90, "phy": 88, "pac": 75, "tec": 75, "num": 2}, {"id": "por4", "name": "Pepe", "pos": ["CB"], "ovr": 82, "att": 45, "def": 85, "phy": 85, "pac": 55, "tec": 70, "num": 3}, {"id": "por5", "name": "Inácio", "pos": ["CB"], "ovr": 81, "att": 50, "def": 82, "phy": 80, "pac": 78, "tec": 75, "num": 4}, {"id": "por6", "name": "Cancelo", "pos": ["RB", "LB"], "ovr": 84, "att": 78, "def": 78, "phy": 75, "pac": 85, "tec": 88, "num": 22}, {"id": "por7", "name": "Mendes", "pos": ["LB"], "ovr": 85, "att": 75, "def": 80, "phy": 78, "pac": 90, "tec": 82, "num": 5}, {"id": "por8", "name": "Palhinha", "pos": ["CDM"], "ovr": 85, "att": 60, "def": 88, "phy": 90, "pac": 70, "tec": 75, "num": 6}, {"id": "por9", "name": "Vitinha", "pos": ["CM"], "ovr": 85, "att": 78, "def": 75, "phy": 72, "pac": 78, "tec": 90, "num": 8}, {"id": "por10", "name": "Bruno Fernandes", "pos": ["CAM", "CM"], "ovr": 87, "att": 88, "def": 60, "phy": 78, "pac": 75, "tec": 90, "num": 10}, {"id": "por11", "name": "Bernardo", "pos": ["CAM", "RW", "LW"], "ovr": 87, "att": 86, "def": 50, "phy": 70, "pac": 80, "tec": 92, "num": 7}, {"id": "por12", "name": "Ronaldo", "pos": ["ST"], "ovr": 86, "att": 90, "def": 30, "phy": 80, "pac": 82, "tec": 88, "num": 9}, {"id": "por13", "name": "Leão", "pos": ["LW", "ST"], "ovr": 86, "att": 88, "def": 35, "phy": 80, "pac": 92, "tec": 85, "num": 11}, {"id": "por14", "name": "Félix", "pos": ["ST", "CAM", "LW"], "ovr": 83, "att": 85, "def": 40, "phy": 72, "pac": 85, "tec": 88, "num": 19}, {"id": "por15", "name": "Neto", "pos": ["RW", "LW"], "ovr": 82, "att": 84, "def": 35, "phy": 70, "pac": 90, "tec": 84, "num": 17}, {"id": "por16", "name": "Silva", "pos": ["CM", "CAM"], "ovr": 81, "att": 78, "def": 70, "phy": 72, "pac": 78, "tec": 85, "num": 14}, {"id": "por17", "name": "Neves", "pos": ["CM", "CDM"], "ovr": 82, "att": 75, "def": 78, "phy": 75, "pac": 72, "tec": 85, "num": 16}, {"id": "por18", "name": "Dalot", "pos": ["RB", "LB"], "ovr": 81, "att": 70, "def": 78, "phy": 80, "pac": 82, "tec": 78, "num": 13}, {"id": "por19", "name": "Rúben Neves", "pos": ["CDM", "CM"], "ovr": 81, "att": 72, "def": 80, "phy": 78, "pac": 70, "tec": 84, "num": 15}, {"id": "por20", "name": "Jota", "pos": ["ST", "LW"], "ovr": 84, "att": 86, "def": 40, "phy": 78, "pac": 88, "tec": 82, "num": 21}, {"id": "por21", "name": "Trubin", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68, "num": 23}, {"id": "por22", "name": "António Silva", "pos": ["CB"], "ovr": 80, "att": 45, "def": 82, "phy": 80, "pac": 75, "tec": 72, "num": 18}, {"id": "por23", "name": "Nuno Mendes", "pos": ["LB"], "ovr": 84, "att": 72, "def": 80, "phy": 78, "pac": 90, "tec": 80, "num": 20}, {"id": "por24", "name": "Rafa", "pos": ["RW", "LW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 88, "tec": 82, "num": 24}, {"id": "por25", "name": "Gonçalo Ramos", "pos": ["ST"], "ovr": 82, "att": 84, "def": 35, "phy": 82, "pac": 82, "tec": 78, "num": 25}], "manager": {"name": "Roberto Martínez", "ovr": 81}}, {"id": "ned", "name": "Netherlands", "short": "NED", "flag": "🇳🇱", "color": "#ff6600", "secondary": "#ffffff", "players": [{"id": "ned1", "name": "Verbruggen", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68, "num": 1}, {"id": "ned2", "name": "Flekken", "pos": ["GK"], "ovr": 81, "att": 18, "def": 81, "phy": 80, "pac": 55, "tec": 68, "num": 12}, {"id": "ned3", "name": "Van Dijk", "pos": ["CB"], "ovr": 89, "att": 55, "def": 90, "phy": 90, "pac": 75, "tec": 78, "num": 2}, {"id": "ned4", "name": "De Ligt", "pos": ["CB"], "ovr": 85, "att": 50, "def": 86, "phy": 88, "pac": 70, "tec": 75, "num": 3}, {"id": "ned5", "name": "Aké", "pos": ["CB", "LB"], "ovr": 82, "att": 50, "def": 84, "phy": 82, "pac": 75, "tec": 75, "num": 4}, {"id": "ned6", "name": "Dumfries", "pos": ["RB"], "ovr": 83, "att": 75, "def": 78, "phy": 88, "pac": 85, "tec": 75, "num": 22}, {"id": "ned7", "name": "Blind", "pos": ["LB", "CB", "CDM"], "ovr": 80, "att": 70, "def": 80, "phy": 72, "pac": 60, "tec": 85, "num": 5}, {"id": "ned8", "name": "Reijnders", "pos": ["CM", "CAM"], "ovr": 83, "att": 80, "def": 72, "phy": 78, "pac": 82, "tec": 84, "num": 8}, {"id": "ned9", "name": "Schouten", "pos": ["CDM", "CM"], "ovr": 81, "att": 70, "def": 82, "phy": 80, "pac": 75, "tec": 80, "num": 6}, {"id": "ned10", "name": "Koopmeiners", "pos": ["CM", "CAM"], "ovr": 83, "att": 80, "def": 75, "phy": 80, "pac": 75, "tec": 85, "num": 10}, {"id": "ned11", "name": "F. de Jong", "pos": ["CM"], "ovr": 86, "att": 78, "def": 78, "phy": 80, "pac": 78, "tec": 90, "num": 14}, {"id": "ned12", "name": "Gakpo", "pos": ["LW", "ST", "CAM"], "ovr": 84, "att": 86, "def": 40, "phy": 80, "pac": 85, "tec": 84, "num": 7}, {"id": "ned13", "name": "Xavi Simons", "pos": ["CAM", "LW", "RW"], "ovr": 83, "att": 84, "def": 40, "phy": 70, "pac": 88, "tec": 88, "num": 20}, {"id": "ned14", "name": "Depay", "pos": ["ST", "LW"], "ovr": 83, "att": 85, "def": 40, "phy": 80, "pac": 82, "tec": 86, "num": 9}, {"id": "ned15", "name": "Weghorst", "pos": ["ST"], "ovr": 80, "att": 82, "def": 40, "phy": 88, "pac": 60, "tec": 72, "num": 19}, {"id": "ned16", "name": "Frimpong", "pos": ["RB", "RW"], "ovr": 84, "att": 80, "def": 70, "phy": 75, "pac": 95, "tec": 80, "num": 11}, {"id": "ned17", "name": "Malen", "pos": ["RW", "ST"], "ovr": 81, "att": 84, "def": 35, "phy": 75, "pac": 92, "tec": 80, "num": 17}, {"id": "ned18", "name": "Bergwijn", "pos": ["LW", "ST"], "ovr": 80, "att": 82, "def": 35, "phy": 75, "pac": 85, "tec": 82, "num": 13}, {"id": "ned19", "name": "Timber", "pos": ["CB", "RB", "LB"], "ovr": 81, "att": 55, "def": 82, "phy": 80, "pac": 80, "tec": 78, "num": 15}, {"id": "ned20", "name": "Geertruida", "pos": ["RB", "CB"], "ovr": 80, "att": 60, "def": 80, "phy": 78, "pac": 80, "tec": 75, "num": 16}, {"id": "ned21", "name": "Bijlow", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68, "num": 23}, {"id": "ned22", "name": "Veerman", "pos": ["CM"], "ovr": 80, "att": 78, "def": 70, "phy": 75, "pac": 70, "tec": 85, "num": 18}, {"id": "ned23", "name": "Brobbey", "pos": ["ST"], "ovr": 80, "att": 82, "def": 30, "phy": 88, "pac": 85, "tec": 72, "num": 21}, {"id": "ned24", "name": "Klaassen", "pos": ["CM", "CAM"], "ovr": 79, "att": 78, "def": 70, "phy": 78, "pac": 70, "tec": 80, "num": 24}, {"id": "ned25", "name": "Zirkzee", "pos": ["ST", "CAM"], "ovr": 80, "att": 82, "def": 40, "phy": 80, "pac": 78, "tec": 82, "num": 25}], "manager": {"name": "Ronald Koeman", "ovr": 82}}], "club": [{"id": "rma", "name": "Real Madrid", "short": "RMA", "flag": "⚪", "color": "#ffffff", "secondary": "#febe10", "players": [{"id": "rma1", "name": "Courtois", "pos": ["GK"], "ovr": 90, "att": 20, "def": 89, "phy": 86, "pac": 55, "tec": 75, "num": 1}, {"id": "rma2", "name": "Lunin", "pos": ["GK"], "ovr": 82, "att": 18, "def": 82, "phy": 80, "pac": 55, "tec": 70, "num": 12}, {"id": "rma3", "name": "Militão", "pos": ["CB"], "ovr": 86, "att": 55, "def": 87, "phy": 86, "pac": 85, "tec": 72, "num": 2}, {"id": "rma4", "name": "Alaba", "pos": ["CB", "LB"], "ovr": 84, "att": 70, "def": 84, "phy": 78, "pac": 78, "tec": 85, "num": 3}, {"id": "rma5", "name": "Rüdiger", "pos": ["CB"], "ovr": 86, "att": 50, "def": 87, "phy": 90, "pac": 80, "tec": 70, "num": 4}, {"id": "rma6", "name": "Carvajal", "pos": ["RB"], "ovr": 85, "att": 70, "def": 84, "phy": 80, "pac": 80, "tec": 82, "num": 22}, {"id": "rma7", "name": "Mendy", "pos": ["LB"], "ovr": 82, "att": 65, "def": 82, "phy": 85, "pac": 85, "tec": 75, "num": 5}, {"id": "rma8", "name": "Tchouaméni", "pos": ["CDM", "CM"], "ovr": 85, "att": 70, "def": 85, "phy": 86, "pac": 75, "tec": 80, "num": 6}, {"id": "rma9", "name": "Camavinga", "pos": ["CM", "LB", "CDM"], "ovr": 84, "att": 72, "def": 80, "phy": 82, "pac": 85, "tec": 82, "num": 8}, {"id": "rma10", "name": "Valverde", "pos": ["CM", "RM", "RB"], "ovr": 88, "att": 82, "def": 80, "phy": 88, "pac": 88, "tec": 85, "num": 10}, {"id": "rma11", "name": "Bellingham", "pos": ["CM", "CAM"], "ovr": 88, "att": 85, "def": 75, "phy": 85, "pac": 82, "tec": 88, "num": 14}, {"id": "rma12", "name": "Modrić", "pos": ["CM", "CAM"], "ovr": 85, "att": 80, "def": 70, "phy": 70, "pac": 70, "tec": 92, "num": 16}, {"id": "rma13", "name": "Kroos", "pos": ["CM", "CDM"], "ovr": 86, "att": 80, "def": 75, "phy": 70, "pac": 55, "tec": 92, "num": 18}, {"id": "rma14", "name": "Vinícius Jr", "pos": ["LW", "ST"], "ovr": 90, "att": 92, "def": 35, "phy": 75, "pac": 95, "tec": 90, "num": 7}, {"id": "rma15", "name": "Rodrygo", "pos": ["RW", "ST", "LW"], "ovr": 86, "att": 88, "def": 40, "phy": 70, "pac": 90, "tec": 88, "num": 11}, {"id": "rma16", "name": "Mbappé", "pos": ["ST", "LW"], "ovr": 91, "att": 93, "def": 35, "phy": 80, "pac": 97, "tec": 88, "num": 9}, {"id": "rma17", "name": "Joselu", "pos": ["ST"], "ovr": 80, "att": 82, "def": 35, "phy": 82, "pac": 60, "tec": 75, "num": 19}, {"id": "rma18", "name": "Brahim", "pos": ["CAM", "RW"], "ovr": 82, "att": 84, "def": 40, "phy": 68, "pac": 85, "tec": 86, "num": 20}, {"id": "rma19", "name": "Güler", "pos": ["CAM", "CM"], "ovr": 80, "att": 82, "def": 40, "phy": 65, "pac": 80, "tec": 88, "num": 13}, {"id": "rma20", "name": "Ceballos", "pos": ["CM", "CAM"], "ovr": 80, "att": 75, "def": 70, "phy": 70, "pac": 75, "tec": 85, "num": 15}, {"id": "rma21", "name": "Nacho", "pos": ["CB", "LB", "RB"], "ovr": 80, "att": 45, "def": 82, "phy": 78, "pac": 70, "tec": 75, "num": 17}, {"id": "rma22", "name": "Lucas Vázquez", "pos": ["RB", "RW"], "ovr": 80, "att": 75, "def": 75, "phy": 75, "pac": 80, "tec": 80, "num": 21}, {"id": "rma23", "name": "Fran García", "pos": ["LB"], "ovr": 79, "att": 70, "def": 75, "phy": 72, "pac": 90, "tec": 78, "num": 23}, {"id": "rma24", "name": "Endrick", "pos": ["ST", "RW"], "ovr": 81, "att": 84, "def": 30, "phy": 78, "pac": 88, "tec": 80, "num": 24}, {"id": "rma25", "name": "Arda Güler", "pos": ["CAM", "RW"], "ovr": 80, "att": 82, "def": 40, "phy": 65, "pac": 80, "tec": 88, "num": 25}], "manager": {"name": "Carlo Ancelotti", "ovr": 90}}, {"id": "mci", "name": "Manchester City", "short": "MCI", "flag": "🔵", "color": "#6cabdd", "secondary": "#1c2c5b", "players": [{"id": "mci1", "name": "Ederson", "pos": ["GK"], "ovr": 88, "att": 25, "def": 86, "phy": 84, "pac": 65, "tec": 75, "num": 1}, {"id": "mci2", "name": "Ortega", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68, "num": 12}, {"id": "mci3", "name": "Dias", "pos": ["CB"], "ovr": 88, "att": 50, "def": 90, "phy": 88, "pac": 75, "tec": 75, "num": 2}, {"id": "mci4", "name": "Akanji", "pos": ["CB", "RB"], "ovr": 83, "att": 55, "def": 84, "phy": 82, "pac": 78, "tec": 75, "num": 3}, {"id": "mci5", "name": "Aké", "pos": ["CB", "LB"], "ovr": 82, "att": 50, "def": 84, "phy": 82, "pac": 75, "tec": 75, "num": 4}, {"id": "mci6", "name": "Walker", "pos": ["RB"], "ovr": 84, "att": 60, "def": 82, "phy": 80, "pac": 90, "tec": 75, "num": 22}, {"id": "mci7", "name": "Gvardiol", "pos": ["LB", "CB"], "ovr": 84, "att": 65, "def": 84, "phy": 85, "pac": 80, "tec": 78, "num": 5}, {"id": "mci8", "name": "Rodri", "pos": ["CDM", "CM"], "ovr": 90, "att": 75, "def": 90, "phy": 85, "pac": 70, "tec": 88, "num": 6}, {"id": "mci9", "name": "Kovacic", "pos": ["CM"], "ovr": 83, "att": 75, "def": 75, "phy": 75, "pac": 78, "tec": 88, "num": 8}, {"id": "mci10", "name": "De Bruyne", "pos": ["CAM", "CM"], "ovr": 90, "att": 90, "def": 60, "phy": 78, "pac": 75, "tec": 94, "num": 10}, {"id": "mci11", "name": "Bernardo", "pos": ["CAM", "RW", "LW"], "ovr": 87, "att": 86, "def": 50, "phy": 70, "pac": 80, "tec": 92, "num": 7}, {"id": "mci12", "name": "Foden", "pos": ["CAM", "RW", "LW"], "ovr": 87, "att": 88, "def": 50, "phy": 72, "pac": 85, "tec": 90, "num": 20}, {"id": "mci13", "name": "Grealish", "pos": ["LW", "CAM"], "ovr": 83, "att": 84, "def": 45, "phy": 72, "pac": 78, "tec": 88, "num": 11}, {"id": "mci14", "name": "Doku", "pos": ["LW", "RW"], "ovr": 83, "att": 84, "def": 35, "phy": 72, "pac": 95, "tec": 85, "num": 17}, {"id": "mci15", "name": "Haaland", "pos": ["ST"], "ovr": 91, "att": 94, "def": 40, "phy": 90, "pac": 90, "tec": 80, "num": 9}, {"id": "mci16", "name": "Álvarez", "pos": ["ST", "CAM"], "ovr": 85, "att": 88, "def": 40, "phy": 78, "pac": 88, "tec": 84, "num": 19}, {"id": "mci17", "name": "Nunes", "pos": ["CM", "RM"], "ovr": 81, "att": 75, "def": 75, "phy": 82, "pac": 85, "tec": 80, "num": 14}, {"id": "mci18", "name": "Lewis", "pos": ["RB", "CM"], "ovr": 78, "att": 65, "def": 75, "phy": 70, "pac": 80, "tec": 78, "num": 13}, {"id": "mci19", "name": "Stones", "pos": ["CB", "CDM"], "ovr": 85, "att": 55, "def": 86, "phy": 82, "pac": 72, "tec": 80, "num": 15}, {"id": "mci20", "name": "Ake", "pos": ["CB", "LB"], "ovr": 82, "att": 50, "def": 84, "phy": 82, "pac": 75, "tec": 75, "num": 16}, {"id": "mci21", "name": "Carson", "pos": ["GK"], "ovr": 75, "att": 15, "def": 75, "phy": 75, "pac": 45, "tec": 60, "num": 23}, {"id": "mci22", "name": "Gomez", "pos": ["CB", "RB"], "ovr": 78, "att": 45, "def": 80, "phy": 78, "pac": 75, "tec": 70, "num": 18}, {"id": "mci23", "name": "McAtee", "pos": ["CAM", "CM"], "ovr": 75, "att": 78, "def": 45, "phy": 65, "pac": 78, "tec": 80, "num": 21}, {"id": "mci24", "name": "Bobb", "pos": ["RW", "CAM"], "ovr": 76, "att": 78, "def": 35, "phy": 65, "pac": 85, "tec": 80, "num": 24}, {"id": "mci25", "name": "Savinho", "pos": ["RW", "LW"], "ovr": 80, "att": 82, "def": 35, "phy": 68, "pac": 90, "tec": 84, "num": 25}], "manager": {"name": "Pep Guardiola", "ovr": 92}}, {"id": "bay", "name": "Bayern Munich", "short": "BAY", "flag": "🔴", "color": "#dc052d", "secondary": "#ffffff", "players": [{"id": "bay1", "name": "Neuer", "pos": ["GK"], "ovr": 86, "att": 30, "def": 85, "phy": 82, "pac": 55, "tec": 80, "num": 1}, {"id": "bay2", "name": "Ulreich", "pos": ["GK"], "ovr": 78, "att": 15, "def": 78, "phy": 75, "pac": 50, "tec": 65, "num": 12}, {"id": "bay3", "name": "Upamecano", "pos": ["CB"], "ovr": 84, "att": 50, "def": 85, "phy": 88, "pac": 82, "tec": 70, "num": 2}, {"id": "bay4", "name": "Kim", "pos": ["CB"], "ovr": 85, "att": 50, "def": 86, "phy": 85, "pac": 80, "tec": 75, "num": 3}, {"id": "bay5", "name": "De Ligt", "pos": ["CB"], "ovr": 85, "att": 50, "def": 86, "phy": 88, "pac": 70, "tec": 75, "num": 4}, {"id": "bay6", "name": "Davies", "pos": ["LB"], "ovr": 85, "att": 75, "def": 80, "phy": 80, "pac": 96, "tec": 80, "num": 5}, {"id": "bay7", "name": "Mazraoui", "pos": ["RB", "LB"], "ovr": 82, "att": 70, "def": 80, "phy": 75, "pac": 85, "tec": 82, "num": 22}, {"id": "bay8", "name": "Kimmich", "pos": ["CDM", "RB", "CM"], "ovr": 87, "att": 78, "def": 85, "phy": 80, "pac": 75, "tec": 88, "num": 6}, {"id": "bay9", "name": "Goretzka", "pos": ["CM", "CDM"], "ovr": 85, "att": 80, "def": 80, "phy": 88, "pac": 78, "tec": 82, "num": 8}, {"id": "bay10", "name": "Musiala", "pos": ["CAM", "CM", "LW"], "ovr": 87, "att": 88, "def": 50, "phy": 72, "pac": 85, "tec": 92, "num": 10}, {"id": "bay11", "name": "Sané", "pos": ["RW", "LW"], "ovr": 84, "att": 85, "def": 35, "phy": 72, "pac": 92, "tec": 85, "num": 7}, {"id": "bay12", "name": "Coman", "pos": ["LW", "RW"], "ovr": 84, "att": 85, "def": 35, "phy": 72, "pac": 92, "tec": 85, "num": 11}, {"id": "bay13", "name": "Kane", "pos": ["ST"], "ovr": 89, "att": 92, "def": 45, "phy": 82, "pac": 70, "tec": 88, "num": 9}, {"id": "bay14", "name": "Müller", "pos": ["CAM", "ST", "RW"], "ovr": 83, "att": 85, "def": 50, "phy": 72, "pac": 70, "tec": 88, "num": 20}, {"id": "bay15", "name": "Gnabry", "pos": ["RW", "ST"], "ovr": 83, "att": 84, "def": 40, "phy": 75, "pac": 85, "tec": 84, "num": 17}, {"id": "bay16", "name": "Palhinha", "pos": ["CDM"], "ovr": 85, "att": 60, "def": 88, "phy": 90, "pac": 70, "tec": 75, "num": 14}, {"id": "bay17", "name": "Laimer", "pos": ["CM", "RB"], "ovr": 82, "att": 75, "def": 80, "phy": 85, "pac": 85, "tec": 78, "num": 16}, {"id": "bay18", "name": "Tel", "pos": ["ST", "LW"], "ovr": 78, "att": 80, "def": 30, "phy": 72, "pac": 88, "tec": 78, "num": 19}, {"id": "bay19", "name": "Guerreiro", "pos": ["LB"], "ovr": 80, "att": 75, "def": 75, "phy": 70, "pac": 80, "tec": 85, "num": 13}, {"id": "bay20", "name": "Dier", "pos": ["CB"], "ovr": 79, "att": 45, "def": 80, "phy": 82, "pac": 55, "tec": 70, "num": 15}, {"id": "bay21", "name": "Peretz", "pos": ["GK"], "ovr": 75, "att": 15, "def": 75, "phy": 75, "pac": 50, "tec": 65, "num": 23}, {"id": "bay22", "name": "Ito", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 88, "tec": 82, "num": 18}, {"id": "bay23", "name": "Goretzka", "pos": ["CM"], "ovr": 85, "att": 80, "def": 80, "phy": 88, "pac": 78, "tec": 82, "num": 21}, {"id": "bay24", "name": "Choupo-Moting", "pos": ["ST"], "ovr": 78, "att": 80, "def": 35, "phy": 80, "pac": 70, "tec": 78, "num": 24}, {"id": "bay25", "name": "Boey", "pos": ["RB"], "ovr": 79, "att": 65, "def": 78, "phy": 78, "pac": 88, "tec": 75, "num": 25}], "manager": {"name": "Vincent Kompany", "ovr": 83}}, {"id": "liv", "name": "Liverpool", "short": "LIV", "flag": "🔴", "color": "#c8102e", "secondary": "#00b2a9", "players": [{"id": "liv1", "name": "Alisson", "pos": ["GK"], "ovr": 89, "att": 20, "def": 88, "phy": 85, "pac": 60, "tec": 70, "num": 1}, {"id": "liv2", "name": "Kelleher", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68, "num": 12}, {"id": "liv3", "name": "Van Dijk", "pos": ["CB"], "ovr": 89, "att": 55, "def": 90, "phy": 90, "pac": 75, "tec": 78, "num": 2}, {"id": "liv4", "name": "Konaté", "pos": ["CB"], "ovr": 84, "att": 48, "def": 85, "phy": 88, "pac": 80, "tec": 70, "num": 3}, {"id": "liv5", "name": "Gomez", "pos": ["CB", "RB"], "ovr": 80, "att": 50, "def": 82, "phy": 80, "pac": 78, "tec": 75, "num": 4}, {"id": "liv6", "name": "Alexander-Arnold", "pos": ["RB", "CM"], "ovr": 86, "att": 80, "def": 78, "phy": 75, "pac": 80, "tec": 90, "num": 22}, {"id": "liv7", "name": "Robertson", "pos": ["LB"], "ovr": 85, "att": 78, "def": 82, "phy": 80, "pac": 85, "tec": 85, "num": 5}, {"id": "liv8", "name": "Endo", "pos": ["CDM"], "ovr": 80, "att": 60, "def": 82, "phy": 82, "pac": 70, "tec": 75, "num": 6}, {"id": "liv9", "name": "Mac Allister", "pos": ["CM", "CAM"], "ovr": 84, "att": 80, "def": 72, "phy": 78, "pac": 75, "tec": 86, "num": 8}, {"id": "liv10", "name": "Szoboszlai", "pos": ["CM", "CAM", "RM"], "ovr": 83, "att": 82, "def": 70, "phy": 82, "pac": 82, "tec": 85, "num": 10}, {"id": "liv11", "name": "Gravenberch", "pos": ["CM", "CDM"], "ovr": 82, "att": 75, "def": 78, "phy": 82, "pac": 82, "tec": 82, "num": 14}, {"id": "liv12", "name": "Salah", "pos": ["RW", "ST"], "ovr": 89, "att": 90, "def": 40, "phy": 78, "pac": 90, "tec": 88, "num": 7}, {"id": "liv13", "name": "Díaz", "pos": ["LW"], "ovr": 85, "att": 86, "def": 40, "phy": 78, "pac": 90, "tec": 85, "num": 11}, {"id": "liv14", "name": "Núñez", "pos": ["ST"], "ovr": 84, "att": 86, "def": 35, "phy": 88, "pac": 90, "tec": 78, "num": 9}, {"id": "liv15", "name": "Jota", "pos": ["ST", "LW"], "ovr": 84, "att": 86, "def": 40, "phy": 78, "pac": 88, "tec": 82, "num": 19}, {"id": "liv16", "name": "Gakpo", "pos": ["LW", "ST", "CAM"], "ovr": 84, "att": 86, "def": 40, "phy": 80, "pac": 85, "tec": 84, "num": 17}, {"id": "liv17", "name": "Elliott", "pos": ["CAM", "RW"], "ovr": 80, "att": 80, "def": 50, "phy": 65, "pac": 80, "tec": 85, "num": 20}, {"id": "liv18", "name": "Jones", "pos": ["CM", "CAM"], "ovr": 79, "att": 75, "def": 70, "phy": 72, "pac": 80, "tec": 82, "num": 16}, {"id": "liv19", "name": "Tsimikas", "pos": ["LB"], "ovr": 79, "att": 70, "def": 78, "phy": 75, "pac": 82, "tec": 78, "num": 13}, {"id": "liv20", "name": "Quansah", "pos": ["CB"], "ovr": 78, "att": 40, "def": 80, "phy": 80, "pac": 75, "tec": 70, "num": 15}, {"id": "liv21", "name": "Adrian", "pos": ["GK"], "ovr": 75, "att": 15, "def": 75, "phy": 75, "pac": 45, "tec": 60, "num": 23}, {"id": "liv22", "name": "Bradley", "pos": ["RB"], "ovr": 77, "att": 65, "def": 75, "phy": 72, "pac": 85, "tec": 75, "num": 18}, {"id": "liv23", "name": "Chiesa", "pos": ["RW", "LW", "ST"], "ovr": 82, "att": 84, "def": 40, "phy": 75, "pac": 88, "tec": 82, "num": 21}, {"id": "liv24", "name": "Bajcetic", "pos": ["CDM", "CM"], "ovr": 75, "att": 60, "def": 75, "phy": 72, "pac": 75, "tec": 75, "num": 24}, {"id": "liv25", "name": "Danns", "pos": ["ST"], "ovr": 72, "att": 75, "def": 30, "phy": 70, "pac": 80, "tec": 72, "num": 25}], "manager": {"name": "Arne Slot", "ovr": 84}}, {"id": "bar", "name": "FC Barcelona", "short": "BAR", "flag": "🔵🔴", "color": "#a50044", "secondary": "#004d98", "players": [{"id": "bar1", "name": "ter Stegen", "pos": ["GK"], "ovr": 88, "att": 25, "def": 87, "phy": 82, "pac": 55, "tec": 78, "num": 1}, {"id": "bar2", "name": "Peña", "pos": ["GK"], "ovr": 78, "att": 18, "def": 78, "phy": 75, "pac": 55, "tec": 68, "num": 12}, {"id": "bar3", "name": "Araujo", "pos": ["CB", "RB"], "ovr": 85, "att": 50, "def": 86, "phy": 88, "pac": 85, "tec": 70, "num": 2}, {"id": "bar4", "name": "Cubarsí", "pos": ["CB"], "ovr": 80, "att": 45, "def": 82, "phy": 75, "pac": 75, "tec": 78, "num": 3}, {"id": "bar5", "name": "Christensen", "pos": ["CB"], "ovr": 83, "att": 45, "def": 85, "phy": 80, "pac": 70, "tec": 78, "num": 4}, {"id": "bar6", "name": "Koundé", "pos": ["RB", "CB"], "ovr": 85, "att": 65, "def": 85, "phy": 82, "pac": 85, "tec": 78, "num": 22}, {"id": "bar7", "name": "Balde", "pos": ["LB"], "ovr": 83, "att": 72, "def": 78, "phy": 75, "pac": 92, "tec": 80, "num": 5}, {"id": "bar8", "name": "Pedri", "pos": ["CM", "CAM"], "ovr": 86, "att": 80, "def": 70, "phy": 70, "pac": 80, "tec": 92, "num": 8}, {"id": "bar9", "name": "Gavi", "pos": ["CM", "LW"], "ovr": 84, "att": 78, "def": 72, "phy": 75, "pac": 82, "tec": 88, "num": 10}, {"id": "bar10", "name": "De Jong", "pos": ["CM"], "ovr": 86, "att": 78, "def": 78, "phy": 80, "pac": 78, "tec": 90, "num": 14}, {"id": "bar11", "name": "Gündoğan", "pos": ["CM", "CAM"], "ovr": 84, "att": 82, "def": 70, "phy": 75, "pac": 70, "tec": 88, "num": 16}, {"id": "bar12", "name": "Yamal", "pos": ["RW"], "ovr": 85, "att": 86, "def": 35, "phy": 65, "pac": 88, "tec": 90, "num": 7}, {"id": "bar13", "name": "Raphinha", "pos": ["RW", "LW"], "ovr": 84, "att": 85, "def": 45, "phy": 72, "pac": 88, "tec": 85, "num": 11}, {"id": "bar14", "name": "Lewandowski", "pos": ["ST"], "ovr": 88, "att": 90, "def": 40, "phy": 82, "pac": 70, "tec": 88, "num": 9}, {"id": "bar15", "name": "Fati", "pos": ["LW", "ST"], "ovr": 80, "att": 82, "def": 30, "phy": 68, "pac": 90, "tec": 84, "num": 17}, {"id": "bar16", "name": "Ferran", "pos": ["ST", "LW"], "ovr": 81, "att": 83, "def": 35, "phy": 75, "pac": 85, "tec": 80, "num": 19}, {"id": "bar17", "name": "Olmo", "pos": ["CAM", "LW"], "ovr": 84, "att": 85, "def": 50, "phy": 72, "pac": 82, "tec": 88, "num": 20}, {"id": "bar18", "name": "Casadó", "pos": ["CDM", "CM"], "ovr": 78, "att": 65, "def": 78, "phy": 75, "pac": 75, "tec": 80, "num": 6}, {"id": "bar19", "name": "Cancelo", "pos": ["RB", "LB"], "ovr": 84, "att": 78, "def": 78, "phy": 75, "pac": 85, "tec": 88, "num": 13}, {"id": "bar20", "name": "Iñigo", "pos": ["CB"], "ovr": 82, "att": 45, "def": 84, "phy": 80, "pac": 70, "tec": 75, "num": 15}, {"id": "bar21", "name": "Iñaki Peña", "pos": ["GK"], "ovr": 78, "att": 18, "def": 78, "phy": 75, "pac": 55, "tec": 68, "num": 23}, {"id": "bar22", "name": "Fort", "pos": ["RB", "LB"], "ovr": 75, "att": 60, "def": 72, "phy": 70, "pac": 85, "tec": 75, "num": 18}, {"id": "bar23", "name": "Torre", "pos": ["CM", "CAM"], "ovr": 76, "att": 75, "def": 60, "phy": 68, "pac": 78, "tec": 80, "num": 21}, {"id": "bar24", "name": "Pau Victor", "pos": ["ST"], "ovr": 75, "att": 78, "def": 30, "phy": 75, "pac": 80, "tec": 75, "num": 24}, {"id": "bar25", "name": "Bernardo", "pos": ["CAM"], "ovr": 78, "att": 80, "def": 40, "phy": 68, "pac": 78, "tec": 84, "num": 25}], "manager": {"name": "Hansi Flick", "ovr": 86}}, {"id": "psg", "name": "Paris Saint-Germain", "short": "PSG", "flag": "🔵🔴", "color": "#004170", "secondary": "#e2b013", "players": [{"id": "psg1", "name": "Donnarumma", "pos": ["GK"], "ovr": 88, "att": 20, "def": 87, "phy": 88, "pac": 60, "tec": 70, "num": 1}, {"id": "psg2", "name": "Safonov", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 80, "pac": 55, "tec": 68, "num": 12}, {"id": "psg3", "name": "Marquinhos", "pos": ["CB"], "ovr": 87, "att": 50, "def": 90, "phy": 85, "pac": 78, "tec": 75, "num": 2}, {"id": "psg4", "name": "Skriniar", "pos": ["CB"], "ovr": 82, "att": 40, "def": 84, "phy": 85, "pac": 65, "tec": 70, "num": 3}, {"id": "psg5", "name": "Pacho", "pos": ["CB"], "ovr": 81, "att": 45, "def": 82, "phy": 82, "pac": 78, "tec": 72, "num": 4}, {"id": "psg6", "name": "Hakimi", "pos": ["RB"], "ovr": 85, "att": 80, "def": 78, "phy": 80, "pac": 92, "tec": 82, "num": 22}, {"id": "psg7", "name": "Mendes", "pos": ["LB"], "ovr": 85, "att": 75, "def": 80, "phy": 78, "pac": 90, "tec": 82, "num": 5}, {"id": "psg8", "name": "Vitinha", "pos": ["CM"], "ovr": 85, "att": 78, "def": 75, "phy": 72, "pac": 78, "tec": 90, "num": 8}, {"id": "psg9", "name": "Ugarte", "pos": ["CDM"], "ovr": 82, "att": 60, "def": 84, "phy": 85, "pac": 75, "tec": 75, "num": 6}, {"id": "psg10", "name": "Zaire-Emery", "pos": ["CM", "CDM"], "ovr": 80, "att": 72, "def": 75, "phy": 75, "pac": 82, "tec": 82, "num": 10}, {"id": "psg11", "name": "Lee", "pos": ["CAM", "CM"], "ovr": 82, "att": 82, "def": 55, "phy": 70, "pac": 80, "tec": 88, "num": 7}, {"id": "psg12", "name": "Dembélé", "pos": ["RW", "LW"], "ovr": 85, "att": 86, "def": 35, "phy": 70, "pac": 92, "tec": 88, "num": 11}, {"id": "psg13", "name": "Barcola", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 35, "phy": 70, "pac": 90, "tec": 82, "num": 17}, {"id": "psg14", "name": "Kvaratskhelia", "pos": ["LW", "RW"], "ovr": 86, "att": 88, "def": 40, "phy": 75, "pac": 85, "tec": 90, "num": 20}, {"id": "psg15", "name": "Mbappé", "pos": ["ST", "LW"], "ovr": 91, "att": 93, "def": 35, "phy": 80, "pac": 97, "tec": 88, "num": 9}, {"id": "psg16", "name": "Ramos", "pos": ["ST"], "ovr": 82, "att": 84, "def": 35, "phy": 82, "pac": 82, "tec": 78, "num": 19}, {"id": "psg17", "name": "Asensio", "pos": ["CAM", "RW"], "ovr": 82, "att": 84, "def": 40, "phy": 68, "pac": 78, "tec": 88, "num": 13}, {"id": "psg18", "name": "Ruiz", "pos": ["CM"], "ovr": 81, "att": 78, "def": 72, "phy": 75, "pac": 75, "tec": 85, "num": 14}, {"id": "psg19", "name": "Hernández", "pos": ["LB"], "ovr": 85, "att": 75, "def": 82, "phy": 80, "pac": 88, "tec": 80, "num": 15}, {"id": "psg20", "name": "Beraldo", "pos": ["CB"], "ovr": 78, "att": 40, "def": 80, "phy": 78, "pac": 75, "tec": 70, "num": 16}, {"id": "psg21", "name": "Navas", "pos": ["GK"], "ovr": 82, "att": 15, "def": 82, "phy": 75, "pac": 55, "tec": 75, "num": 23}, {"id": "psg22", "name": "Zaïre-Emery", "pos": ["CM"], "ovr": 80, "att": 72, "def": 75, "phy": 75, "pac": 82, "tec": 82, "num": 18}, {"id": "psg23", "name": "Mayulu", "pos": ["ST", "CAM"], "ovr": 75, "att": 78, "def": 30, "phy": 70, "pac": 80, "tec": 78, "num": 21}, {"id": "psg24", "name": "Mukiele", "pos": ["RB", "CB"], "ovr": 78, "att": 55, "def": 80, "phy": 82, "pac": 85, "tec": 70, "num": 24}, {"id": "psg25", "name": "Soler", "pos": ["CM", "RM"], "ovr": 79, "att": 75, "def": 70, "phy": 75, "pac": 78, "tec": 82, "num": 25}], "manager": {"name": "Luis Enrique", "ovr": 85}}, {"id": "int", "name": "Inter Milan", "short": "INT", "flag": "🔵⚫", "color": "#010e80", "secondary": "#000000", "players": [{"id": "int1", "name": "Sommer", "pos": ["GK"], "ovr": 87, "att": 18, "def": 86, "phy": 80, "pac": 50, "tec": 72, "num": 1}, {"id": "int2", "name": "Di Gennaro", "pos": ["GK"], "ovr": 75, "att": 15, "def": 75, "phy": 75, "pac": 45, "tec": 60, "num": 12}, {"id": "int3", "name": "Bastoni", "pos": ["CB"], "ovr": 86, "att": 60, "def": 86, "phy": 82, "pac": 75, "tec": 82, "num": 2}, {"id": "int4", "name": "Acerbi", "pos": ["CB"], "ovr": 84, "att": 40, "def": 86, "phy": 82, "pac": 55, "tec": 72, "num": 3}, {"id": "int5", "name": "De Vrij", "pos": ["CB"], "ovr": 83, "att": 40, "def": 85, "phy": 80, "pac": 60, "tec": 75, "num": 4}, {"id": "int6", "name": "Dumfries", "pos": ["RB"], "ovr": 83, "att": 75, "def": 78, "phy": 88, "pac": 85, "tec": 75, "num": 22}, {"id": "int7", "name": "Dimarco", "pos": ["LB", "LM"], "ovr": 84, "att": 80, "def": 78, "phy": 78, "pac": 82, "tec": 85, "num": 5}, {"id": "int8", "name": "Barella", "pos": ["CM"], "ovr": 87, "att": 80, "def": 80, "phy": 82, "pac": 82, "tec": 88, "num": 8}, {"id": "int9", "name": "Çalhanoğlu", "pos": ["CDM", "CM"], "ovr": 86, "att": 82, "def": 80, "phy": 75, "pac": 70, "tec": 90, "num": 6}, {"id": "int10", "name": "Mkhitaryan", "pos": ["CM", "CAM"], "ovr": 83, "att": 80, "def": 70, "phy": 78, "pac": 75, "tec": 85, "num": 10}, {"id": "int11", "name": "Lautaro", "pos": ["ST"], "ovr": 87, "att": 90, "def": 35, "phy": 82, "pac": 82, "tec": 85, "num": 9}, {"id": "int12", "name": "Thuram", "pos": ["ST", "RW"], "ovr": 84, "att": 86, "def": 40, "phy": 85, "pac": 88, "tec": 80, "num": 19}, {"id": "int13", "name": "Frattesi", "pos": ["CM", "CAM"], "ovr": 82, "att": 80, "def": 70, "phy": 80, "pac": 82, "tec": 80, "num": 14}, {"id": "int14", "name": "Taremi", "pos": ["ST"], "ovr": 80, "att": 82, "def": 35, "phy": 78, "pac": 75, "tec": 82, "num": 21}, {"id": "int15", "name": "Asllani", "pos": ["CDM", "CM"], "ovr": 78, "att": 70, "def": 78, "phy": 72, "pac": 75, "tec": 80, "num": 15}, {"id": "int16", "name": "Darmian", "pos": ["RB", "CB", "LB"], "ovr": 80, "att": 60, "def": 82, "phy": 75, "pac": 70, "tec": 75, "num": 7}, {"id": "int17", "name": "Carlos Augusto", "pos": ["LB", "LM"], "ovr": 80, "att": 68, "def": 78, "phy": 76, "pac": 82, "tec": 78, "num": 11}, {"id": "int18", "name": "Bisseck", "pos": ["CB"], "ovr": 78, "att": 45, "def": 80, "phy": 85, "pac": 80, "tec": 68, "num": 16}, {"id": "int19", "name": "Arnautovic", "pos": ["ST"], "ovr": 79, "att": 82, "def": 35, "phy": 82, "pac": 70, "tec": 78, "num": 13}, {"id": "int20", "name": "Pavard", "pos": ["CB", "RB"], "ovr": 81, "att": 60, "def": 82, "phy": 80, "pac": 75, "tec": 75, "num": 17}, {"id": "int21", "name": "Audero", "pos": ["GK"], "ovr": 78, "att": 15, "def": 78, "phy": 78, "pac": 50, "tec": 65, "num": 23}, {"id": "int22", "name": "Zielinski", "pos": ["CM", "CAM"], "ovr": 81, "att": 80, "def": 65, "phy": 70, "pac": 78, "tec": 86, "num": 18}, {"id": "int23", "name": "Correa", "pos": ["ST", "RW"], "ovr": 78, "att": 80, "def": 35, "phy": 70, "pac": 85, "tec": 82, "num": 20}, {"id": "int24", "name": "Buchanan", "pos": ["RW", "RB"], "ovr": 77, "att": 78, "def": 55, "phy": 72, "pac": 90, "tec": 75, "num": 24}, {"id": "int25", "name": "Acerbi", "pos": ["CB"], "ovr": 84, "att": 40, "def": 86, "phy": 82, "pac": 55, "tec": 72, "num": 25}], "manager": {"name": "Simone Inzaghi", "ovr": 87}}, {"id": "ars", "name": "Arsenal", "short": "ARS", "flag": "🔴⚪", "color": "#ef0107", "secondary": "#ffffff", "players": [{"id": "ars1", "name": "Raya", "pos": ["GK"], "ovr": 83, "att": 20, "def": 83, "phy": 78, "pac": 55, "tec": 72, "num": 1}, {"id": "ars2", "name": "Ramsdale", "pos": ["GK"], "ovr": 81, "att": 18, "def": 81, "phy": 78, "pac": 55, "tec": 68, "num": 12}, {"id": "ars3", "name": "Saliba", "pos": ["CB"], "ovr": 87, "att": 45, "def": 88, "phy": 85, "pac": 80, "tec": 75, "num": 2}, {"id": "ars4", "name": "Gabriel", "pos": ["CB"], "ovr": 85, "att": 50, "def": 86, "phy": 88, "pac": 75, "tec": 72, "num": 3}, {"id": "ars5", "name": "White", "pos": ["RB", "CB"], "ovr": 83, "att": 60, "def": 84, "phy": 80, "pac": 75, "tec": 78, "num": 4}, {"id": "ars6", "name": "Timber", "pos": ["RB", "LB", "CB"], "ovr": 81, "att": 55, "def": 82, "phy": 80, "pac": 80, "tec": 78, "num": 22}, {"id": "ars7", "name": "Zinchenko", "pos": ["LB", "CM"], "ovr": 80, "att": 75, "def": 78, "phy": 72, "pac": 75, "tec": 85, "num": 5}, {"id": "ars8", "name": "Rice", "pos": ["CDM", "CM"], "ovr": 87, "att": 70, "def": 88, "phy": 88, "pac": 75, "tec": 80, "num": 6}, {"id": "ars9", "name": "Ødegaard", "pos": ["CAM", "CM"], "ovr": 87, "att": 86, "def": 55, "phy": 70, "pac": 78, "tec": 92, "num": 10}, {"id": "ars10", "name": "Partey", "pos": ["CDM", "CM"], "ovr": 82, "att": 70, "def": 82, "phy": 82, "pac": 70, "tec": 80, "num": 8}, {"id": "ars11", "name": "Saka", "pos": ["RW", "RM"], "ovr": 87, "att": 88, "def": 50, "phy": 75, "pac": 90, "tec": 88, "num": 7}, {"id": "ars12", "name": "Martinelli", "pos": ["LW", "RW"], "ovr": 83, "att": 84, "def": 40, "phy": 72, "pac": 90, "tec": 82, "num": 11}, {"id": "ars13", "name": "Trossard", "pos": ["LW", "ST", "CAM"], "ovr": 82, "att": 84, "def": 45, "phy": 72, "pac": 82, "tec": 85, "num": 17}, {"id": "ars14", "name": "Havertz", "pos": ["ST", "CAM", "CM"], "ovr": 84, "att": 85, "def": 55, "phy": 80, "pac": 80, "tec": 84, "num": 9}, {"id": "ars15", "name": "Jesus", "pos": ["ST", "RW"], "ovr": 82, "att": 84, "def": 45, "phy": 78, "pac": 85, "tec": 84, "num": 19}, {"id": "ars16", "name": "Nwaneri", "pos": ["CAM", "CM"], "ovr": 75, "att": 78, "def": 45, "phy": 65, "pac": 80, "tec": 80, "num": 20}, {"id": "ars17", "name": "Jorginho", "pos": ["CDM", "CM"], "ovr": 80, "att": 70, "def": 80, "phy": 70, "pac": 60, "tec": 88, "num": 14}, {"id": "ars18", "name": "Tomiyasu", "pos": ["RB", "LB", "CB"], "ovr": 80, "att": 55, "def": 82, "phy": 80, "pac": 75, "tec": 75, "num": 13}, {"id": "ars19", "name": "Kiwior", "pos": ["CB", "LB"], "ovr": 78, "att": 45, "def": 80, "phy": 80, "pac": 75, "tec": 70, "num": 15}, {"id": "ars20", "name": "Neto", "pos": ["GK"], "ovr": 80, "att": 18, "def": 80, "phy": 78, "pac": 55, "tec": 68, "num": 23}, {"id": "ars21", "name": "Calafiori", "pos": ["LB", "CB"], "ovr": 81, "att": 65, "def": 80, "phy": 80, "pac": 80, "tec": 80, "num": 16}, {"id": "ars22", "name": "Merino", "pos": ["CM", "CAM"], "ovr": 82, "att": 78, "def": 75, "phy": 82, "pac": 75, "tec": 82, "num": 18}, {"id": "ars23", "name": "Sterling", "pos": ["LW", "RW"], "ovr": 80, "att": 82, "def": 40, "phy": 70, "pac": 88, "tec": 82, "num": 21}, {"id": "ars24", "name": "Zinchenko", "pos": ["LB"], "ovr": 80, "att": 75, "def": 78, "phy": 72, "pac": 75, "tec": 85, "num": 24}, {"id": "ars25", "name": "Vieira", "pos": ["CM", "CAM"], "ovr": 76, "att": 75, "def": 60, "phy": 70, "pac": 80, "tec": 80, "num": 25}], "manager": {"name": "Mikel Arteta", "ovr": 88}}]};


  let teamsData = { national: [], club: [] };
  let allTeams = [];
  let stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {} };
  let tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {} };
  // playerId -> { type, matchesOut, returnDay, teamName }
  let injuryBook = {};
  let globalMatchDay = 1;
  let trophies = []; // {name, team, type, date}
  let currentMatch = null;
  let simInterval = null;
  let simSpeed = 400;
  let isPlaying = false;
  let tournament = null;
  let tournamentType = 'worldcup';

  const FORMATIONS = {
    '4-3-3': { name: '4-3-3', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,50],[50,48],[38,50],[78,28],[50,18],[22,28]] },
    '4-4-2': { name: '4-4-2', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,50],[42,50],[18,48],[58,20],[42,20]] },
    '4-2-3-1': { name: '4-2-3-1', slots: ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[58,55],[42,55],[50,38],[78,30],[22,30],[50,16]] },
    '3-5-2': { name: '3-5-2', slots: ['GK','CB','CB','CB','RWB','CM','CM','CM','LWB','ST','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[88,55],[62,48],[50,50],[38,48],[12,55],[58,20],[42,20]] },
    '4-5-1': { name: '4-5-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CDM','CM','LM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,45],[62,48],[50,55],[38,48],[18,45],[50,18]] },
    '3-4-3': { name: '3-4-3', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'],
      coords: [[50,92],[68,75],[50,78],[32,75],[82,50],[58,48],[42,48],[18,50],[78,25],[50,16],[22,25]] },
    '5-3-2': { name: '5-3-2', slots: ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'],
      coords: [[50,92],[88,68],[68,75],[50,78],[32,75],[12,68],[62,48],[50,50],[38,48],[58,20],[42,20]] },
    '4-1-4-1': { name: '4-1-4-1', slots: ['GK','RB','CB','CB','LB','CDM','RM','CM','CM','LM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[50,58],[82,42],[58,45],[42,45],[18,42],[50,16]] },
    '4-3-2-1': { name: '4-3-2-1', slots: ['GK','RB','CB','CB','LB','CM','CM','CM','CAM','CAM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[62,52],[50,50],[38,52],[62,32],[38,32],[50,16]] },
    '3-4-2-1': { name: '3-4-2-1', slots: ['GK','CB','CB','CB','RM','CM','CM','LM','CAM','CAM','ST'],
      coords: [[50,92],[68,75],[50,78],[32,75],[85,50],[58,52],[42,52],[15,50],[62,30],[38,30],[50,14]] },
    '4-4-1-1': { name: '4-4-1-1', slots: ['GK','RB','CB','CB','LB','RM','CM','CM','LM','CAM','ST'],
      coords: [[50,92],[82,72],[62,75],[38,75],[18,72],[82,48],[58,52],[42,52],[18,48],[50,32],[50,16]] },
    '5-4-1': { name: '5-4-1', slots: ['GK','RWB','CB','CB','CB','LWB','RM','CM','CM','LM','ST'],
      coords: [[50,92],[88,68],[68,75],[50,78],[32,75],[12,68],[80,45],[58,50],[42,50],[20,45],[50,18]] }
  };

  const POS_COMPAT = {
    GK: ['GK'], CB: ['CB','RB','LB'], RB: ['RB','CB','RWB','RM'], LB: ['LB','CB','LWB','LM'],
    RWB: ['RWB','RB','RM'], LWB: ['LWB','LB','LM'], CDM: ['CDM','CM','CB'], CM: ['CM','CDM','CAM'],
    CAM: ['CAM','CM','RW','LW','ST'], RM: ['RM','RW','RWB','CM'], LM: ['LM','LW','LWB','CM'],
    RW: ['RW','RM','ST','CAM'], LW: ['LW','LM','ST','CAM'], ST: ['ST','RW','LW','CAM']
  };

  async function init() {
    try {
      let loaded = null;
      let source = 'embedded';
      const isHosted = location.protocol === 'http:' || location.protocol === 'https:';
      if (isHosted) {
        const urls = [
          'teams.json?v=' + Date.now() + '&r=' + Math.random().toString(36).slice(2),
          './teams.json?v=' + Date.now(),
          'teams.json'
        ];
        for (const url of urls) {
          try {
            const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (!res.ok) continue;
            const data = await res.json();
            if (data && ((data.national && data.national.length) || (data.club && data.club.length))) {
              loaded = data;
              source = 'teams.json';
              console.log('Loaded teams from', url);
              break;
            }
          } catch (err) {
            console.warn('Fetch failed', url, err);
          }
        }
      } else {
        try {
          const res = await fetch('teams.json?v=' + Date.now(), { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && (data.national || data.club)) { loaded = data; source = 'teams.json'; }
          }
        } catch (e) {}
      }
      teamsData = loaded || TEAMS_DATA;
      if (!loaded) {
        source = 'embedded';
        console.warn('Using EMBEDDED team data — teams.json was NOT loaded from server');
      }
      allTeams = [...(teamsData.national || []), ...(teamsData.club || [])];
      if (!allTeams.length) throw new Error('No teams found');
      loadStats();
      populateTeamSelects();
      populateFormations();
      bindNav();
      renderTeamsList();
      console.log('Apex Sim ready:', allTeams.length, 'teams | source:', source);
      window.__APEX_DATA_SOURCE = source;
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
    if (view === 'awards') showAwards('overview');
    if (view === 'teams') renderTeamsList();
  }

  function randomMatch(category) {
    // category: 'national' | 'club' | 'all'
    let pool = allTeams;
    if (category === 'national') pool = teamsData.national || [];
    if (category === 'club') pool = teamsData.club || [];
    if (pool.length < 2) { toast('Need at least 2 teams'); return; }
    const shuffled = shuffleArray([...pool]);
    const home = shuffled[0], away = shuffled[1];
    goToMatch();
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = home.id;
    if (awaySel) awaySel.value = away.id;
    updateTeamPreview('home'); updateTeamPreview('away');
    // Random formations
    const forms = Object.keys(FORMATIONS);
    const hf = document.getElementById('home-formation');
    const af = document.getElementById('away-formation');
    if (hf) hf.value = forms[Math.floor(Math.random()*forms.length)];
    if (af) af.value = forms[Math.floor(Math.random()*forms.length)];
    toast(`${home.flag||''} ${home.name} vs ${away.flag||''} ${away.name}`);
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
      ? 'Select national teams. Supports groups (up to 48 teams, World Cup style).'
      : 'Champions League 2024+ format: select up to 36 clubs. League phase (8 matches each), playoffs, two-leg knockouts, single final.';
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
    const mgr = team.manager ? team.manager.name : '';
    el.innerHTML = `<span class="team-flag">${team.flag || ''}</span><div><div class="team-name">${team.name}</div><div class="manager-name">${mgr ? 'Manager: ' + mgr : ''}</div><div style="font-size:0.8rem;color:var(--text-muted)">${(team.players||[]).length} players</div></div>`;
  }

  function buildSquad(team, formationKey) {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
    const players = shuffleArray([...(team.players || [])].filter(p => !isPlayerInjured(p.id)));
    if (players.length < 11) {
      // Emergency: allow injured if roster too thin
      players.push(...shuffleArray([...(team.players||[])].filter(p => isPlayerInjured(p.id))));
    }
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
    const pm = document.getElementById('post-match-ratings');
    if (pm) { pm.style.display = 'none'; pm.innerHTML = ''; }
    const backBtn = document.getElementById('back-to-tournament');
    if (backBtn) { backBtn.style.display = 'none'; backBtn.classList.remove('show'); }
    updateScoreboard();
    renderLineups();
    const feed = document.getElementById('events-feed');
    if (feed) feed.innerHTML = '';
    addEvent(0, 'whistle', 'Kick off!', null);
    currentMatch.playerMatchStats = {};
    currentMatch.goalList = [];
    currentMatch.countForLeaderboard = !!(tournament || window._tourFixtureIdx != null || window._koRoundIdx != null);
    currentMatch.allowET = !!(document.getElementById('opt-et') && document.getElementById('opt-et').checked);
    currentMatch.allowPens = !!(document.getElementById('opt-pens') && document.getElementById('opt-pens').checked);
    const gt = document.getElementById('goal-timeline');
    if (gt) gt.innerHTML = '';
    isPlaying = false;
    const btn = document.getElementById('btn-play');
    if (btn) btn.textContent = '▶ Play';
  }

  function blankStats() {
    return { shots: 0, shotsOn: 0, possession: 50, fouls: 0, corners: 0, saves: 0, passes: 0, yellows: 0, reds: 0, xg: 0 };
  }

  
  
  function runPenaltyShootout() {
    const m = currentMatch;
    if (!m || m.inPens) return;
    m.inPens = true;
    m.status = 'Penalties';
    addEvent(m.minute, 'pen', '⚽ Penalty shootout!', null);
    let homePens = 0, awayPens = 0;
    const homeTakers = (m.home.squad.starting || []).filter(p => !(p.pos||[]).includes('GK')).sort((a,b)=>(b.att||0)-(a.att||0));
    const awayTakers = (m.away.squad.starting || []).filter(p => !(p.pos||[]).includes('GK')).sort((a,b)=>(b.att||0)-(a.att||0));
    const homeGk = (m.home.squad.starting || []).find(p => (p.pos||[]).includes('GK'));
    const awayGk = (m.away.squad.starting || []).find(p => (p.pos||[]).includes('GK'));
    for (let i = 0; i < 5; i++) {
      const ht = homeTakers[i % homeTakers.length];
      const at = awayTakers[i % awayTakers.length];
      const homeOut = pickPenOutcome();
      const awayOut = pickPenOutcome();
      if (homeOut.scored) {
        homePens++;
        addEvent(m.minute, 'pen', `⚽ ${ht.name} (${m.home.team.short}) ${homeOut.text} [${homePens}-${awayPens}]`, 'home');
      } else {
        addEvent(m.minute, 'pen', `❌ ${ht.name} (${m.home.team.short}) — ${homeOut.text} [${homePens}-${awayPens}]`, 'home');
      }
      if (awayOut.scored) {
        awayPens++;
        addEvent(m.minute, 'pen', `⚽ ${at.name} (${m.away.team.short}) ${awayOut.text} [${homePens}-${awayPens}]`, 'away');
      } else {
        addEvent(m.minute, 'pen', `❌ ${at.name} (${m.away.team.short}) — ${awayOut.text} [${homePens}-${awayPens}]`, 'away');
      }
      // Can we end early?
      const left = 4 - i;
      if (homePens > awayPens + left || awayPens > homePens + left) break;
    }
    // Sudden death if level
    let sd = 0;
    while (homePens === awayPens && sd < 5) {
      const ht = homeTakers[(5 + sd) % homeTakers.length];
      const at = awayTakers[(5 + sd) % awayTakers.length];
      const homeOut = pickPenOutcome();
      const awayOut = pickPenOutcome();
      if (homeOut.scored) { homePens++; addEvent(m.minute, 'pen', `⚽ ${ht.name} (sudden death) ${homeOut.text} [${homePens}-${awayPens}]`, 'home'); }
      else addEvent(m.minute, 'pen', `❌ ${ht.name} (sudden death) — ${homeOut.text} [${homePens}-${awayPens}]`, 'home');
      if (awayOut.scored) { awayPens++; addEvent(m.minute, 'pen', `⚽ ${at.name} (sudden death) ${awayOut.text} [${homePens}-${awayPens}]`, 'away'); }
      else addEvent(m.minute, 'pen', `❌ ${at.name} (sudden death) — ${awayOut.text} [${homePens}-${awayPens}]`, 'away');
      sd++;
    }
    m.home.penScore = homePens;
    m.away.penScore = awayPens;
    // Assign winner for display - don't change regular score, show pens
    addEvent(m.minute, 'whistle', `Penalties: ${m.home.team.short} ${homePens} - ${awayPens} ${m.away.team.short}`, null);
    endMatch();
  }

  function maybeOffsideDisallow(side, scorer, minute) {
    const m = currentMatch;
    if (!m || Math.random() > 0.16) return false; // ~16% of goals get a check
    const team = m[side];
    addEvent(minute, 'var', `📺 VAR checking possible offside in the build-up to ${team.team.short}'s goal...`, side);
    // Pace of attacker vs defence line slightly affects
    const defLine = calcTeamStrength(m[side === 'home' ? 'away' : 'home']);
    const offsideLikely = 0.35 + Math.max(0, (defLine.pac || 70) - (scorer.pac || 70)) / 200;
    if (Math.random() < offsideLikely) {
      team.score = Math.max(0, team.score - 1);
      // remove last goal from list for this side/scorer
      if (m.goalList && m.goalList.length) {
        for (let i = m.goalList.length - 1; i >= 0; i--) {
          if (m.goalList[i].side === side && m.goalList[i].player === scorer.name) {
            m.goalList.splice(i, 1);
            break;
          }
        }
      }
      // undo goal stat (best effort)
      if (stats.goals && stats.goals[scorer.id]) stats.goals[scorer.id].count = Math.max(0, stats.goals[scorer.id].count - 1);
      if (tournament && tournamentStats.goals && tournamentStats.goals[scorer.id]) {
        tournamentStats.goals[scorer.id].count = Math.max(0, tournamentStats.goals[scorer.id].count - 1);
      }
      if (m.playerMatchStats && m.playerMatchStats[scorer.id]) {
        m.playerMatchStats[scorer.id].goals = Math.max(0, (m.playerMatchStats[scorer.id].goals || 1) - 1);
      }
      addEvent(minute, 'var', `VAR: Goal disallowed — <span class="player">${scorer.name}</span> was offside`, side);
      renderGoalTimeline();
      return true;
    }
    addEvent(minute, 'var', `VAR: Goal stands — onside`, side);
    return false;
  }

  function pushGoal(side, player, minute, methodDesc) {
    if (!currentMatch) return;
    if (!currentMatch.goalList) currentMatch.goalList = [];
    currentMatch.goalList.push({ side, player: player.name, num: player.num, minute, method: methodDesc || '' });
    renderGoalTimeline();
  }

  function renderGoalTimeline() {
    const homeEl = document.getElementById('home-goal-scorers');
    const awayEl = document.getElementById('away-goal-scorers');
    if (!currentMatch) {
      if (homeEl) homeEl.innerHTML = '';
      if (awayEl) awayEl.innerHTML = '';
      return;
    }
    const goals = currentMatch.goalList || [];
    const fmt = (arr) => arr.map(g =>
      `<div class="scorer-line"><span class="gt-min">${g.minute}'</span> ${g.player}${g.num != null && g.num !== '' ? ' · '+g.num : ''}${g.method ? ' <span class="gt-method">('+g.method+')</span>' : ''}</div>`
    ).join('');
    if (homeEl) homeEl.innerHTML = fmt(goals.filter(g => g.side === 'home'));
    if (awayEl) awayEl.innerHTML = fmt(goals.filter(g => g.side === 'away'));
  }

  function buildMatchReport(m) {
    if (!m) return null;
    return {
      home: { id: m.home.team.id, name: m.home.team.name, short: m.home.team.short, flag: m.home.team.flag, score: m.home.score, penScore: m.home.penScore, stats: JSON.parse(JSON.stringify(m.home.stats || {})), formation: m.home.squad && m.home.squad.formation },
      away: { id: m.away.team.id, name: m.away.team.name, short: m.away.team.short, flag: m.away.team.flag, score: m.away.score, penScore: m.away.penScore, stats: JSON.parse(JSON.stringify(m.away.stats || {})), formation: m.away.squad && m.away.squad.formation },
      events: (m.events || []).map(e => ({ minute: e.minute, type: e.type, text: e.text, side: e.side })),
      goals: JSON.parse(JSON.stringify(m.goalList || [])),
      ratings: m.playerMatchStats ? JSON.parse(JSON.stringify(m.playerMatchStats)) : {},
      finished: true
    };
  }

  function showMatchReport(report) {
    if (!report) { toast('No match details available'); return; }
    const modal = document.getElementById('match-report-modal');
    const content = document.getElementById('match-report-content');
    if (!modal || !content) return;
    const h = report.home, a = report.away;
    const scoreLine = (h.penScore != null)
      ? `${h.score} (${h.penScore}) - (${a.penScore}) ${a.score}`
      : `${h.score} - ${a.score}`;
    const goalsH = (report.goals || []).filter(g => g.side === 'home');
    const goalsA = (report.goals || []).filter(g => g.side === 'away');
    const fmtG = (arr) => arr.map(g => `${g.minute}' ${g.player}${g.method ? ' ('+g.method+')' : ''}`).join('<br>') || '—';
    const ratings = Object.values(report.ratings || {}).sort((x,y) => (y.rating||0)-(x.rating||0));
    const homeIds = new Set(); // approximate by team name match later
    let eventsHtml = (report.events || []).filter(e => e.type !== 'pressure' || Math.random() < 0.3).slice(-80).map(e => {
      const t = (e.text || '').replace(/<[^>]+>/g, '');
      return `<div class="report-event"><span class="re-min">${e.minute}'</span> <span class="re-type">${e.type}</span> ${t}</div>`;
    }).join('');
    // show important events only for cleaner view
    eventsHtml = (report.events || []).filter(e => ['goal','yellow','red','injury','sub','pen','var','motm','whistle','save','miss'].includes(e.type)).map(e => {
      const t = (e.text || '').replace(/<[^>]+>/g, '');
      return `<div class="report-event"><span class="re-min">${e.minute}'</span> ${t}</div>`;
    }).join('');
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:0.85rem;color:var(--text-muted)">Match Report</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px">
          <div style="flex:1;text-align:left"><div style="font-size:1.4rem">${h.flag||''}</div><strong>${h.name}</strong><div class="goal-scorers">${fmtG(goalsH)}</div></div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent-gold)">${scoreLine}</div>
          <div style="flex:1;text-align:right"><div style="font-size:1.4rem">${a.flag||''}</div><strong>${a.name}</strong><div class="goal-scorers away-scorers">${fmtG(goalsA)}</div></div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">${h.formation||''} vs ${a.formation||''}</div>
      </div>
      <div class="card-title">Key Events</div>
      <div style="max-height:220px;overflow-y:auto;margin-bottom:12px">${eventsHtml || '<span style="color:var(--text-muted)">No events logged</span>'}</div>
      <div class="card-title">Team Stats</div>
      <table class="lb-table" style="margin-bottom:12px"><thead><tr><th></th><th>${h.short}</th><th>${a.short}</th></tr></thead>
      <tbody>
        <tr><td>Shots</td><td>${(h.stats&&h.stats.shots)||0}</td><td>${(a.stats&&a.stats.shots)||0}</td></tr>
        <tr><td>On Target</td><td>${(h.stats&&h.stats.shotsOn)||0}</td><td>${(a.stats&&a.stats.shotsOn)||0}</td></tr>
        <tr><td>Possession</td><td>${(h.stats&&h.stats.possession)||50}%</td><td>${(a.stats&&a.stats.possession)||50}%</td></tr>
        <tr><td>Corners</td><td>${(h.stats&&h.stats.corners)||0}</td><td>${(a.stats&&a.stats.corners)||0}</td></tr>
        <tr><td>Fouls</td><td>${(h.stats&&h.stats.fouls)||0}</td><td>${(a.stats&&a.stats.fouls)||0}</td></tr>
        <tr><td>Saves</td><td>${(h.stats&&h.stats.saves)||0}</td><td>${(a.stats&&a.stats.saves)||0}</td></tr>
        <tr><td>Yellow / Red</td><td>${(h.stats&&h.stats.yellows)||0} / ${(h.stats&&h.stats.reds)||0}</td><td>${(a.stats&&a.stats.yellows)||0} / ${(a.stats&&a.stats.reds)||0}</td></tr>
      </tbody></table>
      <div class="card-title">Player Ratings</div>
      <div style="max-height:200px;overflow-y:auto">
        ${ratings.slice(0,22).map(p => {
          const rc = (p.rating||0) >= 7.5 ? 'rating-high' : (p.rating||0) >= 6.5 ? 'rating-mid' : 'rating-low';
          return `<div class="pm-player"><span class="player-num">${p.num||''}</span><span style="flex:1">${p.name}</span><span class="rating-badge ${rc}">${(p.rating||0).toFixed(1)}</span></div>`;
        }).join('') || '—'}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('match-report-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }

  function viewFixtureReport(idx) {
    if (!tournament || !tournament.fixtures[idx] || !tournament.fixtures[idx].report) {
      toast('No detailed report for this match');
      return;
    }
    showMatchReport(tournament.fixtures[idx].report);
  }

  function viewKnockoutReport(ri, mi) {
    const m = tournament && tournament.knockout[ri] && tournament.knockout[ri].matches[mi];
    if (!m || !m.report) { toast('No detailed report for this match'); return; }
    showMatchReport(m.report);
  }


  function blankPlayerMatchStats(p) {
    return { id: p.id, name: p.name, num: p.num, pos: (p.pos||[])[0], ovr: p.ovr, goals: 0, assists: 0, shots: 0, saves: 0, tackles: 0, passes: 0, xg: 0, xa: 0, rating: 6.0, yellow: false, red: false };
  }

  function pickGoalMethod(shooter) {
    const methods = [
      { desc: 'low driven finish across the keeper', xg: 0.38, puskas: false },
      { desc: 'side-footed placement into the far corner', xg: 0.36, puskas: false },
      { desc: 'powerful right-footed strike', xg: 0.33, puskas: false },
      { desc: 'left-footed drive', xg: 0.32, puskas: false },
      { desc: 'towering header', xg: 0.30, puskas: false },
      { desc: 'glancing near-post header', xg: 0.28, puskas: false },
      { desc: 'tap-in from close range', xg: 0.58, puskas: false },
      { desc: 'poacher\'s finish at the far post', xg: 0.48, puskas: false },
      { desc: 'deflected effort that wrong-foots the keeper', xg: 0.22, puskas: false },
      { desc: 'low screamer into the bottom corner', xg: 0.16, puskas: true },
      { desc: 'dipping shot from outside the box', xg: 0.14, puskas: true },
      { desc: 'rising drive that flies into the roof of the net', xg: 0.13, puskas: true },
      { desc: 'knuckleball strike that swerves late', xg: 0.12, puskas: true },
      { desc: 'blitz curler into the top corner', xg: 0.15, puskas: true },
      { desc: 'inch-perfect curled finish around the wall', xg: 0.17, puskas: true },
      { desc: 'chip over the advancing keeper', xg: 0.20, puskas: true },
      { desc: 'first-time volley on the half-turn', xg: 0.18, puskas: true },
      { desc: 'overhead kick', xg: 0.10, puskas: true },
      { desc: 'bicycle kick', xg: 0.09, puskas: true },
      { desc: 'rabona finish', xg: 0.08, puskas: true },
      { desc: 'solo run from halfway, then cool finish', xg: 0.19, puskas: true },
      { desc: 'cut inside and arrowed shot near post', xg: 0.24, puskas: false },
      { desc: 'rebound smashed home', xg: 0.42, puskas: false },
      { desc: 'toe-poke under the keeper', xg: 0.40, puskas: false }
    ];
    const spectacular = methods.filter(m => m.puskas);
    const normal = methods.filter(m => !m.puskas);
    const tec = shooter.tec || 70;
    if (tec > 88 && Math.random() < 0.42) return spectacular[Math.floor(Math.random() * spectacular.length)];
    if (tec > 82 && Math.random() < 0.28) return spectacular[Math.floor(Math.random() * spectacular.length)];
    return Math.random() < 0.18 ? spectacular[Math.floor(Math.random()*spectacular.length)] : normal[Math.floor(Math.random()*normal.length)];
  }

  function pickMissDesc(shooter) {
    const list = [
      'drags a low shot inches wide of the far post',
      'blasts a rising shot over the crossbar',
      'sees a dipping effort glance off the top of the bar',
      'side-foots wide from a promising angle',
      'scuffs a close-range chance wide of the near post',
      'hits a first-time volley into the stands',
      'curls a shot just beyond the far upright',
      'fires a low screamer that skims past the post',
      'leans back and sends a header over',
      'is denied by the angle as the shot rolls across the face of goal'
    ];
    return list[Math.floor(Math.random() * list.length)];
  }

  function pickSaveDesc(gk, shooter) {
    const list = [
      `strong hands from <span class="player">${gk.name}</span> to push away a fierce drive`,
      `<span class="player">${gk.name}</span> dives full length to tip a curler around the post`,
      `reflex save — <span class="player">${gk.name}</span> blocks from point-blank range`,
      `<span class="player">${gk.name}</span> gets down quickly to hold a low shot`,
      `spectacular tip over from <span class="player">${gk.name}</span> as a rising shot threatens the top corner`,
      `<span class="player">${gk.name}</span> parries a knuckleball, then gathers at the second attempt`,
      `brave claim by <span class="player">${gk.name}</span> under pressure from the striker`
    ];
    return list[Math.floor(Math.random() * list.length)];
  }

  function pickSkillDesc(player, opponent) {
    const moves = [
      'elastico', 'roulette', 'step-over', 'double touch', 'body feint',
      'rabona', 'sombrero flick', 'rainbow flick', 'marseille turn',
      'shoulder drop', 'scissors', 'stop-and-go', 'drag-back'
    ];
    const move = moves[Math.floor(Math.random() * moves.length)];
    const opp = opponent ? opponent.name : 'the defender';
    const ends = [
      `beats ${opp} with a ${move}`,
      `uses a ${move} to leave ${opp} on the ground`,
      `sells ${opp} with a sharp ${move}`,
      `skins ${opp} using a ${move} and accelerates clear`,
      `bamboozles ${opp} with a ${move} on the touchline`
    ];
    return `<span class="player">${player.name}</span> ${ends[Math.floor(Math.random() * ends.length)]}`;
  }

  function pickPenOutcome() {
    // precise outcomes for pens
    const outcomes = [
      { scored: true, text: 'sends the keeper the wrong way — bottom left' },
      { scored: true, text: 'smashes high into the top-right corner' },
      { scored: true, text: 'cool finish down the middle as the keeper dives early' },
      { scored: true, text: 'low and hard to the keeper\'s right' },
      { scored: true, text: 'panenka chip that floats under the bar' },
      { scored: false, text: 'saved — the keeper guesses correctly and palms it away to his left' },
      { scored: false, text: 'saved low to the right — strong hand from the goalkeeper' },
      { scored: false, text: 'crashes against the crossbar and stays out' },
      { scored: false, text: 'skewed wide of the left post' },
      { scored: false, text: 'keeper tips it onto the upright — rebound cleared' }
    ];
    // ~72% score rate
    const scoredOnes = outcomes.filter(o => o.scored);
    const missedOnes = outcomes.filter(o => !o.scored);
    if (Math.random() < 0.72) return scoredOnes[Math.floor(Math.random() * scoredOnes.length)];
    return missedOnes[Math.floor(Math.random() * missedOnes.length)];
  }

  function pickFkOutcome() {
    const outcomes = [
      { scored: true, text: 'whipped curler over the wall into the top corner' },
      { scored: true, text: 'knuckleball that dips late under the bar' },
      { scored: true, text: 'low drive that skids under the jumping wall' },
      { scored: true, text: 'rising shot into the far top corner' },
      { scored: false, text: 'cleared off the line after the keeper was beaten' },
      { scored: false, text: 'kept out — the keeper tips a curling effort over the bar' },
      { scored: false, text: 'struck into the wall and spun away for a corner' },
      { scored: false, text: 'inches over the crossbar' },
      { scored: false, text: 'curls wide of the far post' }
    ];
    if (Math.random() < 0.22) return outcomes.filter(o=>o.scored)[Math.floor(Math.random()*3)];
    return outcomes.filter(o=>!o.scored)[Math.floor(Math.random()*6)];
  }


  function calcPlayerRating(ps) {
    let r = 6.0 + (Math.random() * 0.25 - 0.08);
    r += (ps.goals || 0) * 1.15;
    r += (ps.assists || 0) * 0.85;
    r += Math.min((ps.shots || 0) * 0.12, 0.6);
    r += Math.min((ps.saves || 0) * 0.28, 1.8);
    r += Math.min((ps.tackles || 0) * 0.18, 0.7);
    r += Math.min((ps.passes || 0) * 0.02, 0.4);
    r += Math.min((ps.xg || 0) * 0.25, 0.5);
    r += Math.min((ps.xa || 0) * 0.2, 0.4);
    if ((ps.saves || 0) >= 5) r += 0.3;
    if ((ps.goals || 0) >= 2) r += 0.25;
    if ((ps.goals || 0) >= 3) r += 0.35;
    if (ps.yellow) r -= 0.35;
    if (ps.red) r -= 1.6;
    r += ((ps.ovr || 75) - 75) * 0.008;
    return Math.max(4.0, Math.min(9.9, Math.round(r * 10) / 10));
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
      addEvent(45, 'whistle', '—— HALF TIME ——', null);
      addEvent(45, 'whistle', 'Tap Play to start 2nd half', null);
      updateScoreboard();
      // Pause at half time (unless turbo finish)
      if (!silent) {
        clearInterval(simInterval);
        isPlaying = false;
        const btn = document.getElementById('btn-play');
        if (btn) btn.textContent = '▶ 2nd Half';
        return;
      }
    }
    if (m.minute === 46) {
      m.status = '2nd Half';
      addEvent(46, 'whistle', 'Second half begins', null);
    }
    if (m.minute >= 90 && !m.inET && !m.inPens) {
      if (!m._stoppage) m._stoppage = 1 + Math.floor(Math.random() * 5);
      if (m.minute >= 90 + m._stoppage) {
        // Check ET
        if (m.allowET && m.home.score === m.away.score) {
          m.inET = true;
          m.status = 'Extra Time';
          addEvent(m.minute, 'et', '⏱ Full time — scores level! Extra time begins', null);
          m.etStart = m.minute;
          updateScoreboard();
          return;
        }
        if (m.allowPens && m.home.score === m.away.score) {
          runPenaltyShootout();
          return;
        }
        endMatch();
        return;
      }
      m.status = 'Stoppage Time';
    }
    // Extra time: 2x15 min (simplified as +30 minutes)
    if (m.inET && !m.inPens) {
      const etMin = m.minute - (m.etStart || 90);
      if (etMin >= 30) {
        if (m.allowPens && m.home.score === m.away.score) {
          runPenaltyShootout();
          return;
        }
        endMatch();
        return;
      }
      if (etMin === 15) {
        addEvent(m.minute, 'et', 'End of first half of extra time', null);
      }
      m.status = 'Extra Time ' + Math.min(etMin, 30) + "'";
      // Higher chance of events in ET fatigue
      if (Math.random() < 0.006) tryInjury(Math.random() < 0.5 ? 'home' : 'away');
    }
    generateEvents();
    if (m.minute >= 55 && m.minute <= 85 && Math.random() < 0.08) {
      trySubstitution(Math.random() < 0.5 ? 'home' : 'away');
    }
    if (Math.random() < 0.0035) tryInjury(Math.random() < 0.5 ? 'home' : 'away');
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
    // Stronger teams create more moments
    const intensity = 0.42 + (homeStr.ovr + awayStr.ovr) / 500;
    if (Math.random() > intensity) {
      // Quiet spell with occasional texture
      if (Math.random() < 0.08) {
        const side = Math.random() < 0.5 ? m.home : m.away;
        const p = pickPlayer(side, ['CM','CDM','CAM','CB']);
        if (p) addEvent(m.minute, 'pass', `<span class="player">${p.name}</span> keeps things tidy in midfield`, side === m.home ? 'home' : 'away');
      }
      return;
    }

    const r = Math.random();
    const attackingSide = Math.random() < homeChance ? 'home' : 'away';
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const attTeam = m[attackingSide], defTeam = m[defendingSide];

    if (r < 0.22) {
      const shooter = pickPlayer(attTeam, ['ST','RW','LW','CAM','CM','RM','LM']);
      if (!shooter) return;
      attTeam.stats.shots++;
      // Attributes matter: att/tec/ovr vs defence
      const shotQuality = ((shooter.att || 70) * 0.45 + (shooter.tec || 70) * 0.35 + (shooter.ovr || 75) * 0.2) / 100;
      const defAvg = calcTeamStrength(defTeam).def / 100;
      const onTargetChance = Math.min(0.72, Math.max(0.18, 0.22 + shotQuality * 0.4 - defAvg * 0.12));
      if (Math.random() < onTargetChance) {
        attTeam.stats.shotsOn++;
        if (!m.playerMatchStats) m.playerMatchStats={};
        if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id]=blankPlayerMatchStats(shooter);
        m.playerMatchStats[shooter.id].shots++;
        const gk = pickPlayer(defTeam, ['GK']);
        const gkSkill = gk ? ((gk.def || 70) * 0.5 + (gk.ovr || 75) * 0.3 + (gk.tec || 70) * 0.2) / 100 : 0.7;
        const saveChance = Math.min(0.82, Math.max(0.28, 0.38 + gkSkill * 0.35 - shotQuality * 0.25));
        if (Math.random() < saveChance) {
          if (gk) {
            defTeam.stats.saves++;
            recordStat('saves', gk, defTeam.team);
            addEvent(m.minute, 'save', `Great save by <span class="player">${gk.name}</span>!`, attackingSide);
          }
        } else {
          const assister = pickPlayer(attTeam, ['CAM','CM','RW','LW','ST','RM','LM'], shooter.id);
          attTeam.score++;
          const method = pickGoalMethod(shooter);
          recordStat('goals', shooter, attTeam.team);
          if (method.puskas) recordStat('puskas', shooter, attTeam.team);
          pushGoal(attackingSide, shooter, m.minute, method.desc);
          // track xG
          if (!m.playerMatchStats) m.playerMatchStats = {};
          if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id] = blankPlayerMatchStats(shooter);
          m.playerMatchStats[shooter.id].goals++;
          m.playerMatchStats[shooter.id].xg += method.xg;
          if (assister && Math.random() < 0.7) {
            recordStat('assists', assister, attTeam.team);
            if (!m.playerMatchStats[assister.id]) m.playerMatchStats[assister.id] = blankPlayerMatchStats(assister);
            m.playerMatchStats[assister.id].assists++;
            m.playerMatchStats[assister.id].xa += 0.3 + Math.random() * 0.4;
            addEvent(m.minute, 'goal', `⚽ <span class="player">${shooter.name}</span> (${shooter.num||''}) — ${method.desc}. Assist: <span class="player">${assister.name}</span>`, attackingSide, true);
          } else {
            addEvent(m.minute, 'goal', `⚽ <span class="player">${shooter.name}</span> (${shooter.num||''}) — ${method.desc}`, attackingSide, true);
          }
          maybeOffsideDisallow(attackingSide, shooter, m.minute);
        }
      } else {
        if (!m.playerMatchStats) m.playerMatchStats={};
        if (!m.playerMatchStats[shooter.id]) m.playerMatchStats[shooter.id]=blankPlayerMatchStats(shooter);
        m.playerMatchStats[shooter.id].shots++;
        m.playerMatchStats[shooter.id].xg += 0.05 + Math.random()*0.1;
        addEvent(m.minute, 'miss', `<span class="player">${shooter.name}</span> ${pickMissDesc(shooter)}`, attackingSide);
      }
    } else if (r < 0.32) {
      attTeam.stats.corners++;
      addEvent(m.minute, 'corner', `Corner for ${attTeam.team.short}`, attackingSide);
      if (Math.random() < 0.12) {
        const scorer = pickPlayer(attTeam, ['ST','CB','CM','CAM']);
        if (scorer) {
          attTeam.score++;
          recordStat('goals', scorer, attTeam.team);
          pushGoal(attackingSide, scorer, m.minute, 'header from corner');
          addEvent(m.minute, 'goal', `Corner converted. <span class="player">${scorer.name}</span> (${scorer.num||''}) heads home`, attackingSide, true);
        }
      }
    } else if (r < 0.45) {
      const fouler = pickPlayer(defTeam, ['CB','CDM','CM','RB','LB','ST']);
      if (!fouler) return;
      defTeam.stats.fouls++;
      if (!m.foulCounts) m.foulCounts = { home: {}, away: {} };
      m.foulCounts[defendingSide][fouler.id] = (m.foulCounts[defendingSide][fouler.id] || 0) + 1;
      const foulCount = m.foulCounts[defendingSide][fouler.id];
      const alreadyYellow = (m.cards[defendingSide][fouler.id] || 0) >= 1;
      const aggression = 1 + Math.max(0, (75 - (fouler.def || 70)) / 80) + Math.max(0, ((fouler.phy || 70) - 80) / 100);
      let yellowChance = 0.08 * aggression + (foulCount - 1) * 0.14;
      let straightRedChance = 0.012 * aggression;
      if (alreadyYellow) yellowChance += 0.18;
      if (foulCount >= 3) yellowChance += 0.2;
      yellowChance = Math.min(0.72, yellowChance);
      const roll = Math.random();
      const victim = pickPlayer(attTeam, ['ST','RW','LW','CAM','CM']);
      const foulText = victim
        ? `<span class="player">${fouler.name}</span> fouls <span class="player">${victim.name}</span>`
        : `Foul by <span class="player">${fouler.name}</span>`;
      if (roll < straightRedChance && !alreadyYellow) {
        defTeam.stats.reds++;
        recordStat('cards', fouler, defTeam.team);
        recordStat('reds', fouler, defTeam.team);
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
        m.playerMatchStats[fouler.id].red = true;
        addEvent(m.minute, 'red', `🟥 Straight red! ${foulText} — reckless challenge`, defendingSide);
        removeFromPitch(defendingSide, fouler.id);
      } else if (roll < straightRedChance + yellowChance) {
        m.cards[defendingSide][fouler.id] = (m.cards[defendingSide][fouler.id] || 0) + 1;
        defTeam.stats.yellows++;
        recordStat('cards', fouler, defTeam.team);
        recordStat('yellows', fouler, defTeam.team);
        if (!m.playerMatchStats) m.playerMatchStats = {};
        if (!m.playerMatchStats[fouler.id]) m.playerMatchStats[fouler.id] = blankPlayerMatchStats(fouler);
        m.playerMatchStats[fouler.id].yellow = true;
        if (m.cards[defendingSide][fouler.id] >= 2) {
          defTeam.stats.reds++;
          recordStat('reds', fouler, defTeam.team);
          m.playerMatchStats[fouler.id].red = true;
          addEvent(m.minute, 'red', `🟥 Second yellow → red! ${foulText}`, defendingSide);
          removeFromPitch(defendingSide, fouler.id);
        } else {
          addEvent(m.minute, 'yellow', `🟨 Yellow card — ${foulText}${foulCount > 1 ? ' (repeated fouls)' : ''}`, defendingSide);
        }
      } else {
        addEvent(m.minute, 'foul', foulText + (foulCount > 1 ? ' — referee has a word' : ''), defendingSide);
      }
    
} else if (r < 0.55) {
      const taker = pickPlayer(attTeam, ['CAM','CM','ST','RW','LW']);
      if (taker && Math.random() < 0.18) {
        attTeam.stats.shots++;
        const fk = pickFkOutcome();
        addEvent(m.minute, 'shot', `<span class="player">${taker.name}</span> stands over the free-kick...`, attackingSide);
        if (fk.scored) {
          attTeam.stats.shotsOn++;
          attTeam.score++;
          recordStat('goals', taker, attTeam.team);
          pushGoal(attackingSide, taker, m.minute, fk.text);
          addEvent(m.minute, 'goal', `⚽ Free-kick goal! <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide, true);
          if (Math.random() < 0.55) recordStat('puskas', taker, attTeam.team);
        } else {
          if (fk.text.includes('keeper') || fk.text.includes('tips')) {
            attTeam.stats.shotsOn++;
            const gk = pickPlayer(defTeam, ['GK']);
            if (gk) { defTeam.stats.saves++; recordStat('saves', gk, defTeam.team); }
          }
          addEvent(m.minute, 'miss', `Free-kick from <span class="player">${taker.name}</span> — ${fk.text}`, attackingSide);
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
    } else if (r < 0.85) {
      // Skill move / dribble
      const p = pickPlayer(attTeam, ['RW','LW','CAM','ST','RM','LM']);
      if (p && Math.random() < 0.5) {
        addEvent(m.minute, 'skill', `✨ Skill move by <span class="player">${p.name}</span>! Beats the defender`, attackingSide);
      }
    } else if (r < 0.9) {
      // Handball
      const p = pickPlayer(defTeam, ['CB','RB','LB','CDM','ST']);
      if (p) {
        defTeam.stats.fouls++;
        addEvent(m.minute, 'handball', `Handball against <span class="player">${p.name}</span> — referee points to the spot`, defendingSide);
        if (Math.random() < 0.28) {
          const taker = pickPlayer(attTeam, ['ST','CAM','CM']);
          if (taker) {
            addEvent(m.minute, 'pen', `Penalty to ${attTeam.team.short}. <span class="player">${taker.name}</span> on the spot.`, attackingSide);
            attTeam.stats.shots++;
            const po = pickPenOutcome();
            if (po.scored) {
              attTeam.stats.shotsOn++;
              attTeam.score++;
              recordStat('goals', taker, attTeam.team);
              pushGoal(attackingSide, taker, m.minute, 'penalty — ' + po.text);
              addEvent(m.minute, 'goal', `⚽ Penalty goal! <span class="player">${taker.name}</span> ${po.text}`, attackingSide, true);
            } else {
              const gk = pickPlayer(defTeam, ['GK']);
              if (po.text.includes('saved') || po.text.includes('palms') || po.text.includes('hand')) {
                attTeam.stats.shotsOn++;
                if (gk) { defTeam.stats.saves++; recordStat('saves', gk, defTeam.team); }
              }
              addEvent(m.minute, 'miss', `Penalty missed — <span class="player">${taker.name}</span>: ${po.text}`, attackingSide);
            }
          }
        }
      }
    } else if (r < 0.94) {
      // VAR — coherent sequence for one side
      const varSide = attackingSide;
      const varTeam = attTeam;
      const defSide = defendingSide;
      const scenario = Math.random();
      if (scenario < 0.35) {
        // Potential goal review
        addEvent(m.minute, 'var', `📺 VAR checking possible offside in the build-up (${varTeam.team.short})...`, varSide);
        if (Math.random() < 0.55) {
          addEvent(m.minute, 'var', `VAR: Goal stands for ${varTeam.team.short}`, varSide);
        } else {
          addEvent(m.minute, 'var', `VAR: Goal disallowed — offside against ${varTeam.team.short}`, varSide);
        }
      } else if (scenario < 0.7) {
        // Penalty review for attacking team
        const fouled = pickPlayer(attTeam, ['ST','RW','LW','CAM']);
        const fouler = pickPlayer(defTeam, ['CB','RB','LB','CDM']);
        addEvent(m.minute, 'var', `📺 VAR checking penalty claim — foul on ${fouled?fouled.name:'attacker'} by ${fouler?fouler.name:'defender'} (${varTeam.team.short})...`, varSide);
        if (Math.random() < 0.5) {
          addEvent(m.minute, 'var', `VAR: Penalty awarded to ${varTeam.team.short}!`, varSide);
          const taker = pickPlayer(attTeam, ['ST','CAM','CM']) || fouled;
          if (taker) {
            addEvent(m.minute, 'pen', `Penalty to ${varTeam.team.short}. <span class="player">${taker.name}</span> places the ball on the spot.`, varSide);
            attTeam.stats.shots++;
            const po = pickPenOutcome();
            if (po.scored) {
              attTeam.stats.shotsOn++;
              attTeam.score++;
              recordStat('goals', taker, attTeam.team);
              pushGoal(varSide, taker, m.minute, 'penalty — ' + po.text);
              addEvent(m.minute, 'goal', `⚽ Penalty goal! <span class="player">${taker.name}</span> ${po.text}`, varSide, true);
            } else {
              const gk = pickPlayer(defTeam, ['GK']);
              if (po.text.includes('saved') || po.text.includes('palms') || po.text.includes('hand')) {
                attTeam.stats.shotsOn++;
                if (gk) { defTeam.stats.saves++; recordStat('saves', gk, defTeam.team); }
              }
              addEvent(m.minute, 'miss', `Penalty missed — <span class="player">${taker.name}</span>: ${po.text}`, varSide);
            }
          }
        } else {
          addEvent(m.minute, 'var', `VAR: No penalty — play on`, null);
        }
      } else {
        // Red card review
        const player = pickPlayer(defTeam, ['CB','ST','CDM','CM']);
        addEvent(m.minute, 'var', `📺 VAR checking possible red card (${defTeam.team.short})...`, defSide);
        if (player && Math.random() < 0.4) {
          defTeam.stats.reds++;
          recordStat('reds', player, defTeam.team);
          addEvent(m.minute, 'red', `VAR: Red card! <span class="player">${player.name}</span> (${defTeam.team.short}) sent off`, defSide);
          removeFromPitch(defSide, player.id);
        } else {
          addEvent(m.minute, 'var', `VAR: No red card — yellow only / play on`, null);
        }
      }
    } else if (r < 0.97 && Math.random() < 0.18) {
      const rare = Math.random();
      const att = pickPlayer(attTeam, ['ST','CAM','RW','LW','CM']);
      const def = pickPlayer(defTeam, ['CB','RB','LB','CDM']);
      if (rare < 0.12) {
        addEvent(m.minute, 'whistle', `Rain starts to lash the pitch — footing becomes tricky`, null);
      } else if (rare < 0.24 && att) {
        addEvent(m.minute, 'miss', `<span class="player">${att.name}</span> steals in at the far post but side-foots wide of the upright`, attackingSide);
      } else if (rare < 0.36) {
        addEvent(m.minute, 'whistle', `Stoppage as the referee speaks to both captains after a flare-up`, null);
      } else if (rare < 0.48 && def) {
        addEvent(m.minute, 'foul', `<span class="player">${def.name}</span> times a sliding tackle to perfection on the edge of the box`, defendingSide);
      } else if (rare < 0.58 && att) {
        addEvent(m.minute, 'skill', pickSkillDesc(att, pickPlayer(defTeam, ['CB','RB','LB','CDM','CM'])), attackingSide);
      } else if (rare < 0.68 && att) {
        addEvent(m.minute, 'pass', `<span class="player">${att.name}</span> threads a defence-splitting ball into the channel`, attackingSide);
      } else if (rare < 0.78) {
        const gk = pickPlayer(defTeam, ['GK']);
        if (gk) addEvent(m.minute, 'save', `<span class="player">${gk.name}</span> rushes off the line to smother a through ball`, defendingSide);
      } else if (rare < 0.88 && att) {
        addEvent(m.minute, 'shot', `<span class="player">${att.name}</span> hits a first-time volley — always rising over the bar`, attackingSide);
        attTeam.stats.shots++;
      } else {
        addEvent(m.minute, 'whistle', `The crowd sense a goal — noise levels rise as ${attTeam.team.short} advance`, null);
      }
    } else if (Math.random() < 0.35) {
      const lines = [
        `${attTeam.team.short} recycle possession in the final third`,
        `${attTeam.team.short} work an opening down the flank`,
        `Patient build-up from ${attTeam.team.short}`,
        `${defTeam.team.short} hold a high line under pressure`,
        `Cross claimed comfortably — ${defTeam.team.short} clear`
      ];
      addEvent(m.minute, 'pressure', lines[Math.floor(Math.random()*lines.length)], attackingSide);
    }
  }

  function calcTeamStrength(side) {
    if (!currentMatch || !side) return { att: 50, def: 50, tec: 50 };
    const isHome = side === currentMatch.home;
    const ids = isHome ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    const onPitch = (side.squad.all || []).filter(p => ids.includes(p.id));
    if (!onPitch.length) return { att: 50, def: 50, tec: 50 };
    const mgr = (side.team.manager && side.team.manager.ovr) || 75;
    const avg = (key, fallback) => onPitch.reduce((s, p) => s + (p[key] != null ? p[key] : fallback), 0) / onPitch.length;
    return {
      att: avg('att', 70) + (mgr - 75) * 0.12,
      def: avg('def', 70) + (mgr - 75) * 0.1,
      tec: avg('tec', 70),
      ovr: avg('ovr', 75),
      phy: avg('phy', 70),
      pac: avg('pac', 70)
    };
  }

  function pickPlayer(side, preferredPos, excludeId) {
    if (!currentMatch || !side) return null;
    const ids = side === currentMatch.home ? currentMatch.homeOnPitch : currentMatch.awayOnPitch;
    let pool = (side.squad.all || []).filter(p => ids.includes(p.id) && p.id !== excludeId);
    if (preferredPos && preferredPos.length) {
      const preferred = pool.filter(p => (p.pos || []).some(pos => preferredPos.includes(pos)) || preferredPos.includes(p.slot));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) return null;
    // Weight selection toward higher ovr / relevant attrs
    const weights = pool.map(p => {
      let w = (p.ovr || 70) + (p.att || 70) * 0.3 + (p.tec || 70) * 0.2;
      return Math.max(5, w);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
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

  function isPlayerInjured(playerId) {
    const rec = injuryBook[playerId];
    if (!rec) return false;
    return globalMatchDay < rec.returnDay;
  }

  function tryInjury(side) {
    const m = currentMatch;
    if (!m) return;
    const sideData = m[side];
    const onPitchIds = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
    const pool = (sideData.squad.all || []).filter(p => onPitchIds.includes(p.id) && (p.pos || [])[0] !== 'GK' && !isPlayerInjured(p.id));
    if (!pool.length) return;
    const injured = pool[Math.floor(Math.random() * pool.length)];
    const injuryTypes = [
      { type: 'Ankle sprain', min: 1, max: 3 },
      { type: 'Hamstring strain', min: 2, max: 5 },
      { type: 'Knee knock', min: 1, max: 2 },
      { type: 'Calf strain', min: 2, max: 4 },
      { type: 'Shoulder injury', min: 1, max: 3 },
      { type: 'Concussion protocol', min: 1, max: 2 },
      { type: 'Groin strain', min: 2, max: 4 },
      { type: 'Fractured metatarsal', min: 4, max: 8 },
      { type: 'ACL concern (precaution)', min: 3, max: 6 },
      { type: 'Muscle fatigue / cramp', min: 1, max: 1 }
    ];
    // Weighted toward minor
    const roll = Math.random();
    let info;
    if (roll < 0.55) info = injuryTypes[Math.floor(Math.random() * 3)];
    else if (roll < 0.85) info = injuryTypes[3 + Math.floor(Math.random() * 4)];
    else info = injuryTypes[7 + Math.floor(Math.random() * 3)];
    const outMatches = info.min + Math.floor(Math.random() * (info.max - info.min + 1));
    const returnDay = globalMatchDay + outMatches;
    injuryBook[injured.id] = {
      type: info.type,
      matchesOut: outMatches,
      returnDay,
      teamName: sideData.team.name,
      playerName: injured.name
    };
    m.injuries.push(injured.id);
    addEvent(m.minute, 'injury',
      `🩹 <span class="player">${injured.name}</span> — ${info.type}. Out for ${outMatches} matchday${outMatches>1?'s':''} (back MD ${returnDay})`,
      side);
    try { localStorage.setItem('apexInjuryBook', JSON.stringify(injuryBook)); } catch(e) {}
    const used = side === 'home' ? m.homeSubsUsed : m.awaySubsUsed;
    if (used < m.maxSubs) {
      const availableSubs = (sideData.squad.subs || []).filter(p => !onPitchIds.includes(p.id) && !m.injuries.includes(p.id) && !isPlayerInjured(p.id));
      if (availableSubs.length) {
        let candidates = availableSubs.filter(p => canPlay(p, injured.slot || (injured.pos || ['CM'])[0]));
        if (!candidates.length) candidates = availableSubs;
        candidates.sort((a, b) => (b.ovr || 70) - (a.ovr || 70));
        const inPlayer = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
        const idx = onPitchIds.indexOf(injured.id);
        if (idx >= 0) onPitchIds[idx] = inPlayer.id;
        if (side === 'home') m.homeSubsUsed++; else m.awaySubsUsed++;
        addEvent(m.minute, 'sub', `Forced sub: <span class="player">${inPlayer.name}</span> replaces injured <span class="player">${injured.name}</span>`, side);
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
    // Compute ratings for everyone who played, then MOTM = highest rating
    if (!m.playerMatchStats) m.playerMatchStats = {};
    const allOnPitch = [...(m.home.squad.starting||[]), ...(m.away.squad.starting||[])];
    // Include subs who came on
    const onIds = new Set([...(m.homeOnPitch||[]), ...(m.awayOnPitch||[])]);
    const allInvolved = [...(m.home.squad.all||[]), ...(m.away.squad.all||[])].filter(p =>
      onIds.has(p.id) || allOnPitch.some(s => s.id === p.id) || (m.playerMatchStats[p.id] && (
        m.playerMatchStats[p.id].goals || m.playerMatchStats[p.id].assists || m.playerMatchStats[p.id].shots || m.playerMatchStats[p.id].saves
      ))
    );
    const pool = allInvolved.length ? allInvolved : allOnPitch;
    pool.forEach(p => {
      if (!m.playerMatchStats[p.id]) m.playerMatchStats[p.id] = blankPlayerMatchStats(p);
      // Baseline involvement for starters without events
      const ps = m.playerMatchStats[p.id];
      if (!(ps.passes||0) && onIds.has(p.id)) ps.passes = 8 + Math.floor(Math.random()*20);
      if (!(ps.tackles||0) && onIds.has(p.id) && Math.random() < 0.4) ps.tackles = 1 + Math.floor(Math.random()*3);
      ps.rating = calcPlayerRating(ps);
      // Track average rating for leaderboard
      recordRating(p, (m.home.squad.all||[]).find(x=>x.id===p.id) ? m.home.team : m.away.team, ps.rating);
    });
    let best = null, bestR = -1;
    Object.values(m.playerMatchStats).forEach(ps => {
      if (ps.rating > bestR) { bestR = ps.rating; best = ps; }
    });
    if (best) {
      const team = (m.home.squad.all || []).find(p => p.id === best.id) ? m.home.team : m.away.team;
      const playerObj = [...(m.home.squad.all||[]), ...(m.away.squad.all||[])].find(p => p.id === best.id) || best;
      recordStat('motm', playerObj, team);
      addEvent(90, 'motm', `Player of the Match: <span class="player">${best.name}</span> (${best.rating.toFixed(1)})`, null);
    }
    renderPostMatchRatings();
    globalMatchDay++;
    // Clear recovered injuries
    Object.keys(injuryBook).forEach(id => {
      if (injuryBook[id].returnDay <= globalMatchDay) delete injuryBook[id];
    });
    saveStats();
    updateScoreboard();
    updateStatsPanel();
    if (typeof window._tourFixtureIdx === 'number') {
      const backBtn = document.getElementById('back-to-tournament');
      if (backBtn) { backBtn.style.display = 'flex'; backBtn.classList.add('show'); }
    }
    // If this was a tournament match, update fixture
    
    // UCL league live result
    if (typeof window._uclFixtureIdx === 'number' && tournament && tournament.fixtures) {
      const f = tournament.fixtures[window._uclFixtureIdx];
      if (f && !f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        applyLeagueResult(f.home, f.away, f.homeScore, f.awayScore);
        window._uclFixtureIdx = null;
        if (tournament.fixtures.every(x => x.played)) advanceUCLFromLeague();
      }
    }
    // Knockout live result
    if (typeof window._koRoundIdx === 'number' && typeof window._koMatchIdx === 'number' && tournament) {
      const km = tournament.knockout[window._koRoundIdx] && tournament.knockout[window._koRoundIdx].matches[window._koMatchIdx];
      if (km && !km.played && currentMatch) {
        km.played = true;
        km.homeScore = currentMatch.home.score;
        km.awayScore = currentMatch.away.score;
        km.report = buildMatchReport(currentMatch);
        if (currentMatch.home.penScore != null) {
          km.penalties = true;
          // Winner by pens or score
          if (currentMatch.home.score !== currentMatch.away.score) {
            km.winner = currentMatch.home.score > currentMatch.away.score ? km.home : km.away;
          } else {
            km.winner = (currentMatch.home.penScore > currentMatch.away.penScore) ? km.home : km.away;
            km.homeScore = currentMatch.home.score;
            km.awayScore = currentMatch.away.score;
          }
        } else if (currentMatch.home.score === currentMatch.away.score) {
          km.winner = Math.random() < 0.5 ? km.home : km.away;
          km.penalties = true;
        } else {
          km.winner = currentMatch.home.score > currentMatch.away.score ? km.home : km.away;
        }
        const ri = window._koRoundIdx;
        window._koRoundIdx = null;
        window._koMatchIdx = null;
        afterKnockoutMatchPlayed(ri);
        toast('Knockout result saved!');
      }
    }
    if (typeof window._tourFixtureIdx === 'number' && tournament && tournament.fixtures[window._tourFixtureIdx]) {
      const f = tournament.fixtures[window._tourFixtureIdx];
      if (!f.played && currentMatch) {
        f.played = true;
        f.homeScore = currentMatch.home.score;
        f.awayScore = currentMatch.away.score;
        f.report = buildMatchReport(currentMatch);
        const g = tournament.groups[f.group];
        if (g) {
          const ht = g.teams.find(t => t.team.id === f.home);
          const at = g.teams.find(t => t.team.id === f.away);
          if (ht && at) {
            ht.played++; at.played++;
            ht.gf += f.homeScore; ht.ga += f.awayScore;
            at.gf += f.awayScore; at.ga += f.homeScore;
            if (f.homeScore > f.awayScore) { ht.won++; ht.pts += 3; at.lost++; }
            else if (f.awayScore > f.homeScore) { at.won++; at.pts += 3; ht.lost++; }
            else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
          }
        }
        window._tourFixtureIdx = null;
        toast('Tournament match result saved!');
      }
    }
  }

  function addEvent(minute, type, text, side, isGoal) {
    if (!currentMatch) return;
    currentMatch.events.push({ minute, type, text, side });
    if (currentMatch.silentDeep) return;
    const feed = document.getElementById('events-feed');
    if (!feed) return;
    const icons = { goal: '⚽', save: '🧤', yellow: '🟨', red: '🟥', sub: '🔄', injury: '🩹', corner: '🚩', foul: '⚠️', shot: '👟', miss: '❌', pass: '➡️', offside: '🚫', whistle: '📢', pressure: '🔥', motm: '⭐', var: '📺', pen: '⚽', skill: '✨', handball: '✋', et: '⏱️' };
    const div = document.createElement('div');
    div.className = 'event-item' + (isGoal || type === 'goal' ? ' event-goal' : '') + (type === 'red' ? ' event-card-red' : '') + (type === 'injury' ? ' event-injury' : '') + (type === 'var' ? ' event-var' : '') + (type === 'pen' ? ' event-pen' : '');
    div.innerHTML = `<span class="event-time">${minute}'</span><span class="event-icon">${icons[type] || '•'}</span><span class="event-text">${text}</span>`;
    feed.insertBefore(div, feed.firstChild);
  }

  function updateScoreboard() {
    if (!currentMatch) return;
    if (currentMatch.silentDeep) return;
    const m = currentMatch;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('live-home-flag', m.home.team.flag || '');
    set('live-home-name', m.home.team.name);
    set('live-home-form', (FORMATIONS[m.home.squad.formation] || {}).name || '');
    set('live-away-flag', m.away.team.flag || '');
    set('live-away-name', m.away.team.name);
    set('live-away-form', (FORMATIONS[m.away.squad.formation] || {}).name || '');
    const hm = document.querySelector('.score-team.home .mgr');
    const am = document.querySelector('.score-team.away .mgr');
    if (hm) hm.textContent = m.home.team.manager ? m.home.team.manager.name : '';
    if (am) am.textContent = m.away.team.manager ? m.away.team.manager.name : '';
    const hs = m.home.penScore != null ? `${m.home.score} (${m.home.penScore})` : m.home.score;
    const as_ = m.away.penScore != null ? `${m.away.score} (${m.away.penScore})` : m.away.score;
    set('live-home-score', hs);
    set('live-away-score', as_);
    set('live-minute', m.inPens ? 'Pens' : (m.minute + "'"));
    set('live-status', m.status);
    renderGoalTimeline();
  }

  function updateStatsPanel() {
    if (!currentMatch) return;
    if (currentMatch.silentDeep) return;
    const h = currentMatch.home.stats, a = currentMatch.away.stats;
    const ts = (h.shots + a.shots) || 1, ton = (h.shotsOn + a.shotsOn) || 1;
    const tc = (h.corners + a.corners) || 1, tf = (h.fouls + a.fouls) || 1, tsv = (h.saves + a.saves) || 1;
    const el = document.getElementById('live-stats');
    if (!el) return;
    const hp = (v, t) => t ? Math.round((v/t)*100) : 50;
    el.innerHTML = `
      <div class="stat-row"><span class="stat-val">${h.shots}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.shots,ts)}%"></div><div class="stat-bar-away" style="width:${hp(a.shots,ts)}%"></div></div><span class="stat-val">${a.shots}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Shots</div>
      <div class="stat-row"><span class="stat-val">${h.shotsOn}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.shotsOn,ton)}%"></div><div class="stat-bar-away" style="width:${hp(a.shotsOn,ton)}%"></div></div><span class="stat-val">${a.shotsOn}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">On Target</div>
      <div class="stat-row"><span class="stat-val">${h.possession}%</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${h.possession}%"></div><div class="stat-bar-away" style="width:${a.possession}%"></div></div><span class="stat-val">${a.possession}%</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Possession</div>
      <div class="stat-row"><span class="stat-val">${h.corners}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.corners,tc)}%"></div><div class="stat-bar-away" style="width:${hp(a.corners,tc)}%"></div></div><span class="stat-val">${a.corners}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Corners</div>
      <div class="stat-row"><span class="stat-val">${h.fouls}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.fouls,tf)}%"></div><div class="stat-bar-away" style="width:${hp(a.fouls,tf)}%"></div></div><span class="stat-val">${a.fouls}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Fouls</div>
      <div class="stat-row"><span class="stat-val">${h.saves}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.saves,tsv)}%"></div><div class="stat-bar-away" style="width:${hp(a.saves,tsv)}%"></div></div><span class="stat-val">${a.saves}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Saves</div>
      <div class="stat-row"><span class="stat-val">${h.yellows}</span><div class="stat-bar-wrap"><div class="stat-bar-home" style="width:${hp(h.yellows,h.yellows+a.yellows||1)}%"></div><div class="stat-bar-away" style="width:${hp(a.yellows,h.yellows+a.yellows||1)}%"></div></div><span class="stat-val">${a.yellows}</span></div>
      <div style="text-align:center;font-size:0.75rem;color:var(--text-muted)">Yellow Cards</div>`;
  }


  function renderPitch() {
    if (!currentMatch) return;
    const m = currentMatch;
    const wrap = document.getElementById('pitch-display');
    if (!wrap) return;

    const luminance = (c) => {
      if (!c || c[0] !== '#') return 128;
      let hex = c.replace('#','');
      if (hex.length === 3) hex = hex.split('').map(ch => ch+ch).join('');
      if (hex.length < 6) return 128;
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      return (r*299 + g*587 + b*114) / 1000;
    };

    const drawTeam = (side) => {
      const s = m[side];
      const form = FORMATIONS[s.squad.formation] || FORMATIONS['4-3-3'];
      const coords = form.coords || [];
      const onPitch = side === 'home' ? m.homeOnPitch : m.awayOnPitch;
      let primary = s.team.color || '#1a237e';
      let secondary = s.team.secondary || '#ffffff';
      const textCol = luminance(primary) > 160 ? '#0a0e17' : '#ffffff';
      const used = [];
      let dots = '';
      (s.squad.starting || []).forEach((p, idx) => {
        if (!onPitch.includes(p.id)) return;
        let c = coords[idx] || [50, 50];
        let x = c[0], y = c[1];
        for (let t = 0; t < 6; t++) {
          if (!used.some(u => Math.hypot(u.x - x, u.y - y) < 8)) break;
          x = Math.max(10, Math.min(90, x + (t % 2 ? 6 : -6)));
          y = Math.max(8, Math.min(92, y + (t % 3 ? 5 : -4)));
        }
        used.push({ x, y });
        const label = (p.name || '').split(' ').pop();
        dots += `<div class="player-dot" style="left:${x}%;top:${y}%;background:${primary};color:${textCol};border:2px solid ${secondary}">
          <span class="dot-num">${p.num || ''}</span>
          <span class="dot-name">${label}</span>
        </div>`;
      });
      return `<div class="mini-pitch team-pitch">
        <div class="pitch-label">${s.team.flag || ''} ${s.team.short} · ${form.name}</div>
        ${dots}
      </div>`;
    };

    wrap.innerHTML = `<div class="pitch-pair">${drawTeam('home')}${drawTeam('away')}</div>`;
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
        h += `<li class="player-item ${inj ? 'injured' : ''}" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer"><span class="player-num">${p.num || ''}</span><span class="player-pos">${p.slot || ''}</span> ${p.name} ${!on && !inj ? '(off)' : ''} ${inj ? '🩹' : ''}<span class="player-ovr">${p.ovr || ''}</span></li>`;
      });
      h += `<li style="margin-top:8px;color:var(--text-muted);font-size:0.8rem">Substitutes</li>`;
      (s.squad.subs || []).forEach(p => {
        const on = (side === 'home' ? m.homeOnPitch : m.awayOnPitch).includes(p.id);
        h += `<li class="player-item sub" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer"><span class="player-num">${p.num || ''}</span><span class="player-pos">${(p.pos||[''])[0]}</span> ${p.name} ${on ? '(on)' : ''}<span class="player-ovr">${p.ovr || ''}</span></li>`;
      });
      return h + '</ul></div>';
    };
    const el = document.getElementById('lineup-display');
    if (el) el.innerHTML = html('home') + html('away');
    renderPitch();
  }

  function recordRating(player, team, rating) {
    if (!player || !team) return;
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) {
    if (!stats.ratings) stats.ratings = {};
    if (!stats.ratings[player.id]) {
      const aff = findPlayerTeams(player.id);
      stats.ratings[player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0, sum: 0, avg: 0, national: aff.national, club: aff.club };
    }
    const e = stats.ratings[player.id];
    e.count++;
    e.sum += rating;
    e.avg = Math.round((e.sum / e.count) * 100) / 100;
    }
    if (tournament) {
      if (!tournamentStats.ratings) tournamentStats.ratings = {};
      if (!tournamentStats.ratings[player.id]) {
        const aff = findPlayerTeams(player.id);
        tournamentStats.ratings[player.id] = { id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0, sum: 0, avg: 0, national: aff.national, club: aff.club };
      }
      const te = tournamentStats.ratings[player.id];
      te.count++;
      te.sum += rating;
      te.avg = Math.round((te.sum / te.count) * 100) / 100;
    }
  }

  function findPlayerTeams(playerId) {
    let national = null, club = null;
    (teamsData.national || []).forEach(t => {
      if ((t.players || []).some(p => p.id === playerId)) national = t.name;
    });
    (teamsData.club || []).forEach(t => {
      if ((t.players || []).some(p => p.id === playerId)) club = t.name;
    });
    // Same player may only exist on one team in our data; also check by name match across
    if (!national || !club) {
      let pname = null;
      allTeams.forEach(t => {
        const p = (t.players || []).find(x => x.id === playerId);
        if (p) pname = p.name;
      });
      if (pname) {
        (teamsData.national || []).forEach(t => {
          if ((t.players || []).some(p => p.name === pname)) national = t.name;
        });
        (teamsData.club || []).forEach(t => {
          if ((t.players || []).some(p => p.name === pname)) club = t.name;
        });
      }
    }
    return { national, club };
  }

  function recordStat(type, player, team) {
    if (!player || !team) return;
    // Friendlies do not feed global leaderboard — only competitive (tournament) matches
    const competitive = !!(tournament || (currentMatch && currentMatch.countForLeaderboard));
    if (competitive) {
      if (!stats[type]) stats[type] = {};
      if (!stats[type][player.id]) {
        const aff = findPlayerTeams(player.id);
        stats[type][player.id] = {
          id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0,
          national: aff.national, club: aff.club
        };
      }
      stats[type][player.id].count++;
    }
    if (tournament) {
      if (!tournamentStats[type]) tournamentStats[type] = {};
      if (!tournamentStats[type][player.id]) {
        const aff = findPlayerTeams(player.id);
        tournamentStats[type][player.id] = {
          id: player.id, name: player.name, team: team.name, teamId: team.id, count: 0,
          national: aff.national, club: aff.club
        };
      }
      tournamentStats[type][player.id].count++;
    }
  }

  function saveStats() {
    try {
      localStorage.setItem('apexSimStats', JSON.stringify(stats));
      localStorage.setItem('apexInjuryBook', JSON.stringify(injuryBook));
      localStorage.setItem('apexMatchDay', String(globalMatchDay));
    } catch(e) {}
  }
  function loadStats() {
    try {
      const s = localStorage.getItem('apexSimStats');
      if (s) stats = JSON.parse(s);
      if (!stats.ratings) stats.ratings = {};
      const t = localStorage.getItem('apexTrophies');
      if (t) trophies = JSON.parse(t);
      const ib = localStorage.getItem('apexInjuryBook');
      if (ib) injuryBook = JSON.parse(ib);
      const md = localStorage.getItem('apexMatchDay');
      if (md) globalMatchDay = parseInt(md, 10) || 1;
    } catch(e) {}
  }

  function resetLeaderboard() {
    if (!confirm('Reset all leaderboard stats? This cannot be undone.')) return;
    stats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, cards: {}, motm: {}, puskas: {}, ratings: {} };
    tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {} };
    try { localStorage.removeItem('apexSimStats'); } catch(e) {}
    saveStats();
    showLeaderboard('goals');
    toast('Leaderboard reset');
  }

  function showLeaderboard(type) {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.lb === type));
    let data;
    if (type === 'ratings') {
      data = Object.values(stats.ratings || {}).filter(x => x.count > 0).sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 20);
    } else {
      data = Object.values(stats[type] || {}).sort((a, b) => b.count - a.count).slice(0, 20);
    }
    const el = document.getElementById('leaderboard-content');
    if (!el) return;
    if (!data.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>No ${type} recorded yet. Simulate matches!</p></div>`;
      return;
    }
    const labels = { goals: 'Goals', assists: 'Assists', saves: 'Saves', cleanSheets: 'Clean Sheets', yellows: 'Yellow Cards', reds: 'Red Cards', cards: 'Cards', motm: 'MOTM', puskas: 'Puskas Nominees', ratings: 'Avg Rating' };
    el.innerHTML = `<table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>${labels[type]||type}</th></tr></thead><tbody>
      ${data.map((p,i) => {
        const aff = [p.national, p.club].filter(Boolean).join(' · ') || p.team;
        return `<tr><td class="lb-rank">${i+1}</td><td class="lb-player">${p.name}</td><td class="lb-team">${aff}</td><td style="font-weight:700;color:var(--accent-gold)">${type==='ratings' ? (p.avg!=null?p.avg.toFixed(2):'—')+' ('+p.count+' apps)' : p.count}</td></tr>`;
      }).join('')}
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

    tournamentStats = { goals: {}, assists: {}, saves: {}, cleanSheets: {}, yellows: {}, reds: {}, motm: {}, ratings: {} };

    if (tournamentType === 'ucl') {
      startUCLTournament(selected);
    } else {
      startWorldCupTournament(selected);
    }

    const setup = document.getElementById('tournament-setup');
    const live = document.getElementById('tournament-live');
    if (setup) setup.style.display = 'none';
    if (live) live.style.display = 'block';
    renderTournamentLeaderboard();
  }

  function startWorldCupTournament(selected) {
    let teams = shuffleArray([...selected]);
    const groupSize = 4;
    let numGroups = Math.floor(teams.length / groupSize);
    if (numGroups < 1) numGroups = 1;
    if (numGroups > 12) numGroups = 12;
    teams = teams.slice(0, numGroups * groupSize);
    if (teams.length < 4) { toast('Need at least 4 teams for groups'); return; }
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push({
        name: String.fromCharCode(65 + i),
        teams: teams.slice(i * groupSize, (i + 1) * groupSize).map(t => ({
          team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
        }))
      });
    }
    tournament = { type: 'worldcup', format: 'groups', groups, knockout: [], stage: 'groups', fixtures: [], champion: null, playoff: [] };
    generateGroupFixtures();
    renderGroups();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Group Stage';
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<p style="color:var(--text-muted)">Knockout bracket appears after groups.</p>';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Round';
  }

  function startUCLTournament(selected) {
    let teams = shuffleArray([...selected]);
    // Prefer 36; if fewer, use largest even count >= 8 (scale format)
    if (teams.length >= 36) teams = teams.slice(0, 36);
    else if (teams.length % 2 === 1) teams = teams.slice(0, teams.length - 1);
    if (teams.length < 8) { toast('Champions League needs at least 8 clubs (36 ideal)'); return; }

    const league = teams.map(t => ({
      team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0
    }));

    const matchesPerTeam = teams.length >= 36 ? 8 : Math.min(8, teams.length - 1);
    const fixtures = generateUCLLeagueFixtures(teams, matchesPerTeam);

    tournament = {
      type: 'ucl',
      format: 'league',
      stage: 'league',
      league,
      fixtures,
      playoff: [],
      knockout: [],
      groups: [],
      champion: null,
      matchesPerTeam
    };

    renderUCLLeague();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'League Phase (' + matchesPerTeam + ' matches each)';
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<p style="color:var(--text-muted)">Playoffs & knockout appear after the league phase.</p>';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate League Round';
    toast('UCL league phase: ' + teams.length + ' teams, ' + fixtures.length + ' matches');
  }

  function generateUCLLeagueFixtures(teams, matchesPerTeam) {
    const fixtures = [];
    const opp = {};
    teams.forEach(t => { opp[t.id] = new Set(); });

    for (let round = 1; round <= matchesPerTeam; round++) {
      const order = shuffleArray([...teams]);
      const used = new Set();
      for (const t of order) {
        if (used.has(t.id)) continue;
        if (opp[t.id].size >= matchesPerTeam) continue;
        const candidate = order.find(o =>
          o.id !== t.id &&
          !used.has(o.id) &&
          !opp[t.id].has(o.id) &&
          opp[o.id].size < matchesPerTeam
        );
        if (!candidate) continue;
        used.add(t.id);
        used.add(candidate.id);
        opp[t.id].add(candidate.id);
        opp[candidate.id].add(t.id);
        // Alternate home roughly by round
        const tHome = (round + t.id.length) % 2 === 0;
        const home = tHome ? t : candidate;
        const away = tHome ? candidate : t;
        fixtures.push({
          phase: 'league',
          round,
          home: home.id,
          away: away.id,
          played: false,
          homeScore: null,
          awayScore: null,
          report: null
        });
      }
    }
    return shuffleArray(fixtures);
  }

  function blankLeagueRow(team) {
    return { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }

  function applyLeagueResult(homeId, awayId, hg, ag) {
    const ht = tournament.league.find(r => r.team.id === homeId);
    const at = tournament.league.find(r => r.team.id === awayId);
    if (!ht || !at) return;
    ht.played++; at.played++;
    ht.gf += hg; ht.ga += ag;
    at.gf += ag; at.ga += hg;
    if (hg > ag) { ht.won++; ht.pts += 3; at.lost++; }
    else if (ag > hg) { at.won++; at.pts += 3; ht.lost++; }
    else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
  }

  function sortedLeague() {
    return [...(tournament.league || [])].sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    );
  }

  function renderUCLLeague() {
    const el = document.getElementById('groups-container');
    if (!el || !tournament || tournament.format !== 'league') return;
    const sorted = sortedLeague();
    let h = '<div class="group-card" style="grid-column:1/-1"><h4>League Phase Table</h4>';
    h += '<table class="group-table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>';
    sorted.forEach((r, i) => {
      const gd = r.gf - r.ga;
      let mark = '';
      if (i < 8) mark = ' style="background:rgba(0,200,83,0.12)"';
      else if (i < 24) mark = ' style="background:rgba(255,171,0,0.1)"';
      else mark = ' style="background:rgba(255,82,82,0.08)"';
      h += `<tr${mark}><td>${i+1}</td><td>${r.team.flag||''} ${r.team.name}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gf}</td><td>${r.ga}</td><td>${gd}</td><td><b>${r.pts}</b></td></tr>`;
    });
    h += '</tbody></table>';
    h += '<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">Green: Top 8 → R16 direct · Amber: 9–24 playoff · Red: 25–36 eliminated</p></div>';
    el.innerHTML = h;

    // Fixtures panel
    const fixEl = document.getElementById('fixtures-list') || el;
    // Use existing fixtures area inside renderGroups path — append via fixtures in live view
    const liveFix = document.querySelector('#tournament-live .fixtures-panel') || document.getElementById('fixture-list');
    renderUCLFixtures();
  }

  function renderUCLFixtures() {
    // Find fixtures container used by renderGroups
    let fixEl = document.getElementById('fixture-list');
    if (!fixEl) {
      // inject after groups if missing
      const gc = document.getElementById('groups-container');
      if (gc && !document.getElementById('fixture-list')) {
        const d = document.createElement('div');
        d.id = 'fixture-list';
        gc.parentNode.insertBefore(d, gc.nextSibling);
        fixEl = d;
      }
    }
    if (!fixEl || !tournament) return;
    const unplayed = (tournament.fixtures || []).filter(f => !f.played).slice(0, 12);
    const played = (tournament.fixtures || []).filter(f => f.played).slice(-8);
    let h = '';
    if (tournament.stage === 'league') {
      h += '<div class="card-title" style="margin-top:12px">League Fixtures</div>';
      unplayed.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const idx = tournament.fixtures.indexOf(f);
        h += `<div class="fixture-item"><span class="fixture-teams">${home.flag||''} ${home.short} vs ${away.flag||''} ${away.short}</span>
          <button class="btn btn-primary btn-sm" onclick="App.playUCLFixture(${idx})">▶ Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simUCLFixture(${idx})">⚡ Instant</button></div>`;
      });
      if (played.length) {
        h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
        played.reverse().forEach(f => {
          const home = getTeam(f.home), away = getTeam(f.away);
          const idx = tournament.fixtures.indexOf(f);
          h += `<div class="fixture-item played" style="cursor:pointer" onclick="App.viewFixtureReport(${idx})">
            <span class="fixture-teams">${home.flag||''} ${home.short} ${f.homeScore}-${f.awayScore} ${away.short}</span>
            <span style="font-size:0.7rem;color:var(--accent-gold)">Details</span></div>`;
        });
      }
    }
    if (tournament.stage === 'playoff' || (tournament.playoff && tournament.playoff.length)) {
      h += '<div class="card-title" style="margin-top:12px">Knockout Playoffs (two legs)</div>';
      (tournament.playoff || []).forEach((p, i) => {
        const status = p.played ? (`Agg ${p.aggHome}-${p.aggAway} → ${p.winner ? p.winner.short : ''}`) : (p.leg1 && p.leg1.played ? 'Leg 2' : 'Leg 1');
        h += `<div class="fixture-item ${p.played?'played':''}">
          <span class="fixture-teams">${p.home.flag||''} ${p.home.short} vs ${p.away.flag||''} ${p.away.short} <small>(${status})</small></span>`;
        if (!p.played) {
          h += `<button class="btn btn-secondary btn-sm" onclick="App.simPlayoffTie(${i})">⚡ Sim Tie</button>`;
        } else if (p.report || (p.leg2 && p.leg2.report)) {
          h += `<button class="btn btn-secondary btn-sm" onclick="App.viewPlayoffReport(${i})">Report</button>`;
        }
        h += '</div>';
      });
    }
    fixEl.innerHTML = h;
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
    if (tournament && tournament.format === 'league') {
      renderUCLLeague();
      return;
    }
    const el = document.getElementById('groups-container');
    if (!el || !tournament) return;
    el.innerHTML = tournament.groups.map(g => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      return `<div class="group-card"><h4>Group ${g.name}</h4><table class="group-table"><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
        ${sorted.map(t => `<tr><td>${t.team.flag || ''} ${t.team.short}</td><td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td><td>${t.gf - t.ga}</td><td class="pts">${t.pts}</td></tr>`).join('')}
      </tbody></table></div>`;
    }).join('');
    // Fixture list with live play option
    const fixEl = document.getElementById('fixture-list');
    if (fixEl && tournament.stage === 'groups') {
      const unplayed = tournament.fixtures.filter(f => !f.played).slice(0, 8);
      const played = tournament.fixtures.filter(f => f.played).slice(-6);
      let h = '<div class="card-title" style="margin-top:12px">Upcoming Fixtures</div>';
      unplayed.forEach((f, i) => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        h += `<div class="fixture-item"><span class="fixture-teams">${home.flag} ${home.short} vs ${away.flag} ${away.short}</span>
          <button class="btn btn-primary btn-sm" onclick="App.playTournamentMatch(${tournament.fixtures.indexOf(f)})">▶ Play Live</button>
          <button class="btn btn-secondary btn-sm" onclick="App.simSingleFixture(${tournament.fixtures.indexOf(f)})">⚡ Instant</button></div>`;
      });
      if (played.length) {
        h += '<div class="card-title" style="margin-top:12px">Recent Results</div>';
        played.reverse().forEach(f => {
          const home = getTeam(f.home), away = getTeam(f.away);
          if (!home || !away) return;
          const idx = tournament.fixtures.indexOf(f);
          h += `<div class="fixture-item played" style="cursor:pointer" onclick="App.viewFixtureReport(${idx})" title="View full match report">
            <span class="fixture-teams">${home.flag} ${home.short} vs ${away.flag} ${away.short}</span>
            <span class="fixture-score">${f.homeScore} - ${f.awayScore}</span>
            <span style="font-size:0.7rem;color:var(--accent-gold);margin-left:6px">Details</span>
          </div>`;
        });
      }
      fixEl.innerHTML = h;
    }
  }

  function simSingleFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    const f = tournament.fixtures[idx];
    const home = getTeam(f.home), away = getTeam(f.away);
    const result = simQuickMatch(home, away);
    f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
    const g = tournament.groups[f.group];
    const ht = g.teams.find(t => t.team.id === f.home);
    const at = g.teams.find(t => t.team.id === f.away);
    if (ht && at) {
      ht.played++; at.played++;
      ht.gf += result.home; ht.ga += result.away;
      at.gf += result.away; at.ga += result.home;
      if (result.home > result.away) { ht.won++; ht.pts += 3; at.lost++; }
      else if (result.away > result.home) { at.won++; at.pts += 3; ht.lost++; }
      else { ht.drawn++; at.drawn++; ht.pts++; at.pts++; }
    }
    renderGroups();
    renderTournamentLeaderboard();
    const remaining = tournament.fixtures.filter(x => !x.played).length;
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = remaining ? `Group Stage — ${remaining} matches left` : 'Group Stage Complete';
    if (!remaining && tournament.stage === 'groups') advanceToKnockout();
  }

  function playTournamentMatch(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    const f = tournament.fixtures[idx];
    const home = getTeam(f.home), away = getTeam(f.away);
    if (!home || !away) return;
    // Store callback context
    window._tourFixtureIdx = idx;
    // Setup match selects and start
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = home.id;
    if (awaySel) awaySel.value = away.id;
    updateTeamPreview('home'); updateTeamPreview('away');
    startMatch();
    toast('Tournament match: play live, then return to Tournament tab');
    // After match ends, update fixture - hook via endMatch check
  }


  function simTournamentRound() {
    if (!tournament) return;
    if (tournament.format === 'league' || tournament.stage === 'league') {
      const unplayed = (tournament.fixtures || []).filter(f => !f.played);
      if (!unplayed.length) { advanceUCLFromLeague(); return; }
      const batch = unplayed.slice(0, Math.max(4, Math.ceil(unplayed.length / 4)));
      batch.forEach(f => {
        const idx = tournament.fixtures.indexOf(f);
        if (idx >= 0) simUCLFixture(idx);
      });
      return;
    }
    if (tournament.stage === 'playoff') {
      tournament.playoff.forEach((p, i) => { if (!p.played) simPlayoffTie(i); });
      return;
    }
    if (tournament.stage === 'groups') {
      const unplayed = tournament.fixtures.filter(f => !f.played);
      if (!unplayed.length) { advanceToKnockout(); return; }
      const batch = unplayed.slice(0, Math.max(2, Math.ceil(unplayed.length / 3)));
      batch.forEach(f => {
        const home = getTeam(f.home), away = getTeam(f.away);
        if (!home || !away) return;
        const result = simQuickMatch(home, away);
        f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
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
      if (!remaining && tournament.stage === 'groups') advanceToKnockout();
    } else if (tournament.stage === 'knockout') {
      simKnockoutRound();
    }
  }

  function simAllTournament() {
    if (!tournament) return;
    toast('Simulating full tournament…');

    if (tournament.format === 'league' || tournament.type === 'ucl') {
      // League fixtures
      (tournament.fixtures || []).forEach((f, idx) => {
        if (!f.played) {
          const home = getTeam(f.home), away = getTeam(f.away);
          if (!home || !away) return;
          const result = simQuickMatch(home, away);
          f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
          applyLeagueResult(f.home, f.away, result.home, result.away);
        }
      });
      if (tournament.stage === 'league') advanceUCLFromLeague();
      // Playoffs
      if (tournament.playoff && tournament.playoff.length) {
        tournament.playoff.forEach((p, i) => {
          if (!p.played) simPlayoffTie(i);
        });
      }
      if (tournament.stage === 'playoff' && tournament.playoff.every(p => p.played)) {
        finishUCLPlayoffs();
      }
      // Knockout rounds
      let guard = 0;
      while (!tournament.champion && tournament.knockout && tournament.knockout.length && guard < 20) {
        guard++;
        const ri = tournament.knockout.length - 1;
        const round = tournament.knockout[ri];
        const isFinal = round.name === 'Final' || round.matches.length === 1;
        round.matches.forEach(m => {
          if (m.played) return;
          if (isFinal || m.twoLeg === false) simSingleFinal(m);
          else simTwoLegTie(m);
        });
        const winners = round.matches.map(m => m.winner).filter(Boolean);
        if (winners.length <= 1) {
          if (winners[0]) setChampion(winners[0]);
          break;
        }
        if (ri === tournament.knockout.length - 1) {
          let list = winners.slice();
          if (list.length % 2 === 1) list.pop();
          if (list.length < 2) {
            setChampion(list[0] || winners[0]);
            break;
          }
          const nextMatches = [];
          const nextIsFinal = list.length === 2;
          for (let i = 0; i < list.length; i += 2) {
            if (nextIsFinal) {
              nextMatches.push({
                home: list[i], away: list[i+1], twoLeg: false, played: false,
                homeScore: null, awayScore: null, winner: null, report: null
              });
            } else {
              nextMatches.push(makeTwoLegTie(list[i], list[i+1]));
            }
          }
          tournament.knockout.push({
            name: getRoundName(list.length),
            matches: nextMatches,
            twoLeg: !nextIsFinal
          });
        }
      }
      assignTournamentAwards();
      renderUCLLeague();
      renderBracket();
      renderTournamentLeaderboard();
      if (tournament.champion) {
        const stageTitle = document.getElementById('tour-stage-title');
        if (stageTitle) stageTitle.textContent = 'Champions: ' + (tournament.champion.flag || '') + ' ' + tournament.champion.name;
        toast(tournament.champion.name + ' win the Champions League!');
      }
      return;
    }

    // —— World Cup path (existing) ——
    (tournament.fixtures || []).forEach(f => {
      if (f.played) return;
      const home = getTeam(f.home), away = getTeam(f.away);
      if (!home || !away) return;
      const result = simQuickMatch(home, away);
      f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
      const g = tournament.groups[f.group];
      if (!g) return;
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
    if (!tournament.champion && tournament.stage !== 'knockout' && tournament.stage !== 'complete') {
      advanceToKnockout();
    }
    let safety = 0;
    while (!tournament.champion && safety < 20) {
      safety++;
      if (!tournament.knockout || !tournament.knockout.length) break;
      const ri = tournament.knockout.length - 1;
      const round = tournament.knockout[ri];
      round.matches.forEach(m => {
        if (m.played) return;
        if (!m.home || !m.away) return;
        const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
        m.homeScore = result.home; m.awayScore = result.away; m.played = true; m.report = result.report;
        if (result.pens) { m.penalties = true; m.winner = result.pens.home > result.pens.away ? m.home : m.away; }
        else if (result.home > result.away) m.winner = m.home;
        else if (result.away > result.home) m.winner = m.away;
        else { m.penalties = true; m.winner = Math.random() < 0.5 ? m.home : m.away; }
      });
      const winners = round.matches.map(m => m.winner).filter(Boolean);
      if (winners.length <= 1) { if (winners[0]) setChampion(winners[0]); break; }
      if (ri === tournament.knockout.length - 1) {
        let list = winners.slice();
        if (list.length % 2 === 1) list.pop();
        if (list.length < 2) { setChampion(list[0] || winners[0]); break; }
        const nextMatches = [];
        for (let i = 0; i < list.length; i += 2) {
          nextMatches.push({ home: list[i], away: list[i+1], homeScore: null, awayScore: null, winner: null, played: false });
        }
        tournament.knockout.push({ name: getRoundName(list.length), matches: nextMatches });
      }
    }
    assignTournamentAwards();
    renderGroups();
    renderBracket();
    renderTournamentLeaderboard();
    if (tournament.champion) {
      const stageTitle = document.getElementById('tour-stage-title');
      if (stageTitle) stageTitle.textContent = 'Champions: ' + (tournament.champion.flag || '') + ' ' + tournament.champion.name;
      toast(tournament.champion.name + ' win the tournament!');
    }
  }


  function simUCLFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    const f = tournament.fixtures[idx];
    const home = getTeam(f.home), away = getTeam(f.away);
    const result = simQuickMatch(home, away);
    f.played = true; f.homeScore = result.home; f.awayScore = result.away; f.report = result.report;
    applyLeagueResult(f.home, f.away, result.home, result.away);
    renderUCLLeague();
    renderTournamentLeaderboard();
    if (tournament.fixtures.every(x => x.played)) {
      toast('League phase complete');
      advanceUCLFromLeague();
    }
  }

  function playUCLFixture(idx) {
    if (!tournament || !tournament.fixtures[idx] || tournament.fixtures[idx].played) return;
    window._uclFixtureIdx = idx;
    window._tourFixtureIdx = null;
    window._koRoundIdx = null;
    const f = tournament.fixtures[idx];
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = f.home;
    if (awaySel) awaySel.value = f.away;
    updateTeamPreview('home'); updateTeamPreview('away');
    startMatch();
  }

  function advanceUCLFromLeague() {
    if (!tournament || tournament.format !== 'league') return;
    const sorted = sortedLeague();
    if (sorted.length < 8) {
      // Small field: top half direct, rest playoff or direct KO
      const half = Math.floor(sorted.length / 2);
      const direct = sorted.slice(0, Math.min(8, half)).map(r => r.team);
      buildUCLKnockoutFromTeams(direct.length >= 2 ? direct : sorted.slice(0, 4).map(r => r.team), true);
      return;
    }

    const direct = sorted.slice(0, 8).map(r => r.team);
    const playoffTeams = sorted.slice(8, Math.min(24, sorted.length));
    const eliminated = sorted.slice(24);

    tournament.stage = 'playoff';
    tournament.playoff = [];

    // Pair 9th vs 24th, 10th vs 23rd, ...
    const n = playoffTeams.length;
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const high = playoffTeams[i];
      const low = playoffTeams[n - 1 - i];
      if (!high || !low) continue;
      tournament.playoff.push({
        home: high.team, // higher rank hosts 2nd leg
        away: low.team,
        seedHigh: i + 9,
        seedLow: 24 - i,
        leg1: { played: false, homeScore: null, awayScore: null, report: null },
        leg2: { played: false, homeScore: null, awayScore: null, report: null },
        aggHome: 0,
        aggAway: 0,
        winner: null,
        played: false
      });
    }

    tournament._uclDirect = direct;
    renderUCLLeague();
    renderUCLFixtures();
    renderBracket();
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Knockout Playoffs (9th–24th)';
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Playoffs';
    toast('Top 8 seeded to R16. Playoffs underway.');
  }

  function simPlayoffTie(idx) {
    if (!tournament || !tournament.playoff[idx] || tournament.playoff[idx].played) return;
    const p = tournament.playoff[idx];
    // Leg 1: away team (lower seed) at home vs higher seed
    const leg1Home = p.away, leg1Away = p.home;
    const r1 = simQuickMatch(leg1Home, leg1Away, { allowET: false, allowPens: false });
    p.leg1 = { played: true, homeScore: r1.home, awayScore: r1.away, report: r1.report, homeId: leg1Home.id, awayId: leg1Away.id };
    // Leg 2: higher seed at home
    const r2 = simQuickMatch(p.home, p.away, { allowET: true, allowPens: true });
    p.leg2 = { played: true, homeScore: r2.home, awayScore: r2.away, report: r2.report, homeId: p.home.id, awayId: p.away.id };
    // Aggregate from higher seed perspective: leg1 away goals + leg2 home goals
    p.aggHome = r1.away + r2.home; // higher seed total
    p.aggAway = r1.home + r2.away; // lower seed total
    if (p.aggHome > p.aggAway) p.winner = p.home;
    else if (p.aggAway > p.aggHome) p.winner = p.away;
    else {
      // Pens already may have decided leg2 if scores level after 90 — if still level use pens flag or random
      if (r2.pens) p.winner = r2.pens.home > r2.pens.away ? p.home : p.away;
      else p.winner = Math.random() < 0.5 ? p.home : p.away;
      p.penalties = true;
    }
    p.played = true;
    renderUCLFixtures();
    if (tournament.playoff.every(x => x.played)) finishUCLPlayoffs();
  }

  function finishUCLPlayoffs() {
    const winners = tournament.playoff.map(p => p.winner).filter(Boolean);
    const direct = tournament._uclDirect || sortedLeague().slice(0, 8).map(r => r.team);
    // R16: typically top seeds vs playoff winners — interleave
    const r16 = [];
    for (let i = 0; i < 8; i++) {
      if (direct[i]) r16.push(direct[i]);
      if (winners[i]) r16.push(winners[i]);
    }
    // Ensure 16 teams
    while (r16.length > 16) r16.pop();
    while (r16.length < 16 && winners.length) { /* pad */ break; }
    buildUCLKnockoutFromTeams(r16, false);
  }

  function buildUCLKnockoutFromTeams(teams, singleLegFinalOnly) {
    let list = teams.filter(Boolean);
    while (list.length >= 2 && (list.length & (list.length - 1))) list.pop();
    if (list.length < 2) { toast('Not enough teams for knockout'); return; }
    tournament.stage = 'knockout';
    const matches = [];
    for (let i = 0; i < list.length; i += 2) {
      matches.push(makeTwoLegTie(list[i], list[i + 1]));
    }
    tournament.knockout = [{ name: getRoundName(list.length), matches, twoLeg: list.length > 2 }];
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = getRoundName(list.length);
    const btn = document.getElementById('btn-sim-round');
    if (btn) btn.textContent = 'Simulate Knockout Round';
    renderBracket();
    renderUCLFixtures();
  }

  function makeTwoLegTie(teamA, teamB) {
    return {
      home: teamA,
      away: teamB,
      twoLeg: true,
      leg1: { played: false, homeScore: null, awayScore: null, report: null },
      leg2: { played: false, homeScore: null, awayScore: null, report: null },
      homeScore: null,
      awayScore: null,
      aggHome: null,
      aggAway: null,
      winner: null,
      played: false,
      penalties: false,
      report: null
    };
  }

  function simTwoLegTie(m) {
    // Leg 1 at away stadium (away hosts)
    const r1 = simQuickMatch(m.away, m.home, { allowET: false, allowPens: false });
    m.leg1 = { played: true, homeScore: r1.home, awayScore: r1.away, report: r1.report };
    // Leg 2 at home stadium
    const r2 = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
    m.leg2 = { played: true, homeScore: r2.home, awayScore: r2.away, report: r2.report };
    m.aggHome = r1.away + r2.home;
    m.aggAway = r1.home + r2.away;
    m.homeScore = m.aggHome;
    m.awayScore = m.aggAway;
    if (m.aggHome > m.aggAway) m.winner = m.home;
    else if (m.aggAway > m.aggHome) m.winner = m.away;
    else {
      if (r2.pens) m.winner = r2.pens.home > r2.pens.away ? m.home : m.away;
      else m.winner = Math.random() < 0.5 ? m.home : m.away;
      m.penalties = true;
    }
    m.played = true;
    m.report = r2.report;
  }

  function simSingleFinal(m) {
    const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
    m.homeScore = result.home;
    m.awayScore = result.away;
    m.played = true;
    m.report = result.report;
    m.twoLeg = false;
    if (result.pens) {
      m.penalties = true;
      m.winner = result.pens.home > result.pens.away ? m.home : m.away;
    } else if (result.home === result.away) {
      m.penalties = true;
      m.winner = Math.random() < 0.5 ? m.home : m.away;
    } else {
      m.winner = result.home > result.away ? m.home : m.away;
    }
  }

  function viewPlayoffReport(idx) {
    const p = tournament && tournament.playoff && tournament.playoff[idx];
    if (!p) return;
    const rep = (p.leg2 && p.leg2.report) || (p.leg1 && p.leg1.report);
    if (rep) showMatchReport(rep);
    else toast('Aggregate: ' + p.aggHome + '-' + p.aggAway);
  }


  function advanceToKnockout() {
    if (!tournament) return;
    if (tournament.stage === 'knockout' || tournament.stage === 'complete') return;
    if (tournament.knockout && tournament.knockout.length) return;
    const qualifiers = [];
    const thirdPlaces = [];
    tournament.groups.forEach(g => {
      const sorted = [...g.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      if (sorted[0]) qualifiers.push(sorted[0].team);
      if (sorted[1]) qualifiers.push(sorted[1].team);
      if (sorted[2]) thirdPlaces.push(sorted[2]);
    });
    // FIFA-style: if we have 12 groups (24 auto + need 8 thirds → 32)
    if (tournament.groups.length >= 8 && thirdPlaces.length) {
      thirdPlaces.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      const need = 32 - qualifiers.length;
      if (need > 0) {
        thirdPlaces.slice(0, need).forEach(t => qualifiers.push(t.team));
      }
    }
    // Always force power of 2 (2,4,8,16,32)
    while (qualifiers.length >= 2 && (qualifiers.length & (qualifiers.length - 1))) {
      qualifiers.pop();
    }
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

  function getRoundName(teamCount) {
    // teamCount = number of teams still in the competition for this round
    if (teamCount >= 32) return 'Round of 32';
    if (teamCount >= 16) return 'Round of 16';
    if (teamCount >= 8) return 'Quarter-finals';
    if (teamCount >= 4) return 'Semi-finals';
    if (teamCount >= 2) return 'Final';
    return 'Knockout';
  }

  function simKnockoutRound() {
    if (!tournament || !tournament.knockout || !tournament.knockout.length) return false;
    if (tournament.champion) return false;
    const current = tournament.knockout[tournament.knockout.length - 1];
    if (!current || !current.matches.length) return false;

    let unplayed = current.matches.filter(m => !m.played);
    if (!unplayed.length) {
      const winners = current.matches.map(m => m.winner).filter(Boolean);
      if (winners.length === 1) { setChampion(winners[0]); renderBracket(); return false; }
      if (winners.length >= 2) {
        createNextKnockoutRound(winners);
        renderBracket();
        return true;
      }
      return false;
    }

    unplayed.forEach(m => {
      if (!m.home || !m.away) return;
      const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
      m.homeScore = result.home;
      m.awayScore = result.away;
      m.played = true;
      m.report = result.report;
      if (result.pens) {
        m.penalties = true;
        m.winner = result.pens.home > result.pens.away ? m.home : m.away;
      } else if (result.home === result.away) {
        m.penalties = true;
        m.winner = Math.random() < 0.5 ? m.home : m.away;
      } else {
        m.winner = result.home > result.away ? m.home : m.away;
      }
    });

    const winners = current.matches.map(m => m.winner).filter(Boolean);
    if (winners.length === 1) {
      setChampion(winners[0]);
    } else if (winners.length >= 2) {
      createNextKnockoutRound(winners);
    }
    renderBracket();
    renderTournamentLeaderboard();
    return true;
  }


  function createNextKnockoutRound(winners) {
    let list = (winners || []).filter(Boolean);
    if (list.length % 2 === 1) list = list.slice(0, list.length - 1);
    if (list.length < 2) {
      if (winners && winners[0]) setChampion(winners[0]);
      return;
    }
    const name = getRoundName(list.length);
    const last = tournament.knockout[tournament.knockout.length - 1];
    if (last && last.name === name && !last.matches.every(m => m.played)) return;
    const nextMatches = [];
    for (let i = 0; i < list.length; i += 2) {
      nextMatches.push({
        home: list[i], away: list[i + 1],
        homeScore: null, awayScore: null, winner: null, played: false, penalties: false
      });
    }
    tournament.knockout.push({ name, matches: nextMatches });
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = name;
  }


  function setChampion(team) {
    if (!team || tournament.champion) return;
    tournament.champion = team;
    tournament.stage = 'complete';
    assignTournamentAwards();
    const tName = tournament.type === 'worldcup' ? 'World Cup' : 'Champions League';
    trophies.push({ name: tName, team: team.name, type: 'Tournament', date: Date.now() });
    try { localStorage.setItem('apexTrophies', JSON.stringify(trophies)); } catch(e) {}
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = 'Champions: ' + (team.flag || '') + ' ' + team.name;
  }

  function simQuickMatch(homeTeam, awayTeam, opts) {
    // Full deep simulation — same engine as live matches (goals, cards, MOTM, injuries, ratings)
    opts = opts || {};
    const prevMatch = currentMatch;
    const prevFixture = window._tourFixtureIdx;
    const prevKoR = window._koRoundIdx;
    const prevKoM = window._koMatchIdx;
    // Prevent live tournament hooks from double-writing during bulk sim
    window._tourFixtureIdx = undefined;
    window._koRoundIdx = undefined;
    window._koMatchIdx = undefined;

    const forms = Object.keys(FORMATIONS);
    const hf = opts.homeForm || forms[Math.floor(Math.random() * forms.length)];
    const af = opts.awayForm || forms[Math.floor(Math.random() * forms.length)];
    const homeSquad = buildSquad(homeTeam, hf);
    const awaySquad = buildSquad(awayTeam, af);

    currentMatch = {
      home: { team: homeTeam, squad: homeSquad, score: 0, stats: blankStats(), penScore: null },
      away: { team: awayTeam, squad: awaySquad, score: 0, stats: blankStats(), penScore: null },
      minute: 0,
      status: '1st Half',
      finished: false,
      events: [],
      homeOnPitch: homeSquad.starting.map(p => p.id),
      awayOnPitch: awaySquad.starting.map(p => p.id),
      homeSubsUsed: 0,
      awaySubsUsed: 0,
      maxSubs: 5,
      injuries: [],
      cards: { home: {}, away: {} },
      playerMatchStats: {},
      goalList: [],
      allowET: !!opts.allowET,
      allowPens: !!opts.allowPens,
      silentDeep: true,
      countForLeaderboard: tournament ? true : !!opts.countForLeaderboard,
      inET: false,
      inPens: false
    };

    let safety = 0;
    while (currentMatch && !currentMatch.finished && safety < 250) {
      tick(true);
      safety++;
    }
    // Force finish if somehow stuck
    if (currentMatch && !currentMatch.finished) {
      endMatch();
    }

    const report = currentMatch ? buildMatchReport(currentMatch) : null;
    const result = {
      home: currentMatch ? currentMatch.home.score : 0,
      away: currentMatch ? currentMatch.away.score : 0,
      pens: currentMatch && currentMatch.home.penScore != null
        ? { home: currentMatch.home.penScore, away: currentMatch.away.penScore }
        : null,
      report
    };

    currentMatch = prevMatch;
    window._tourFixtureIdx = prevFixture;
    window._koRoundIdx = prevKoR;
    window._koMatchIdx = prevKoM;
    saveStats();
    return result;
  }

  function poisson(lambda) {
    const L = Math.exp(-Math.max(0.1, lambda));
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L && k < 10);
    return k - 1;
  }

  
  function assignTournamentAwards() {
    if (!tournament) return;
    const top = (key) => Object.values(tournamentStats[key] || {}).sort((a,b) => b.count - a.count);
    const goals = top('goals');
    const assists = top('assists');
    const saves = top('saves');
    const motm = top('motm');
    const ratings = Object.values(tournamentStats.ratings || {}).filter(x => x.count > 0).sort((a,b) => b.avg - a.avg || b.count - a.count);
    tournament.awards = {
      goldenBoot: goals[0] || null,
      goldenBall: ratings[0] || motm[0] || null,
      goldenGlove: saves[0] || null,
      topAssists: assists[0] || null,
      mostMotm: motm[0] || null
    };
  }

  function renderTournamentAwards() {
    const el = document.getElementById('tour-awards');
    if (!el || !tournament) return;
    if (!tournament.awards) assignTournamentAwards();
    const a = tournament.awards || {};
    const card = (title, icon, p, extra) => {
      if (!p) return `<div class="award-mini"><div class="am-title">${icon} ${title}</div><div class="am-empty">TBD</div></div>`;
      return `<div class="award-mini"><div class="am-title">${icon} ${title}</div>
        <div class="am-name">${p.name}</div>
        <div class="am-meta">${p.team || ''} · ${extra}</div></div>`;
    };
    el.innerHTML = `
      <div class="card-title">Tournament Awards</div>
      <div class="awards-row">
        ${card('Golden Boot', '👟', a.goldenBoot, (a.goldenBoot && a.goldenBoot.count) + ' goals')}
        ${card('Golden Ball', '🏆', a.goldenBall, a.goldenBall && a.goldenBall.avg != null ? ('Avg ' + a.goldenBall.avg.toFixed(2)) : ((a.goldenBall && a.goldenBall.count) + ' MOTM'))}
        ${card('Golden Glove', '🧤', a.goldenGlove, (a.goldenGlove && a.goldenGlove.count) + ' saves')}
        ${card('Top Assists', '🎯', a.topAssists, (a.topAssists && a.topAssists.count) + ' assists')}
      </div>`;
  }

  function renderTournamentLeaderboard() {
    assignTournamentAwards();
    renderTournamentAwards();
    const el = document.getElementById('tour-stats-preview');
    if (!el) return;
    const top = (key, n) => Object.values(tournamentStats[key] || {}).sort((a,b)=>b.count-a.count).slice(0, n);
    const g = top('goals', 8), a = top('assists', 5), m = top('motm', 5);
    const y = top('yellows', 5), r = top('reds', 5), s = top('saves', 5);
    const hasAny = g.length || a.length || m.length || y.length || r.length;
    if (!hasAny) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Play tournament matches to fill stats (goals, cards, MOTM…).</p>';
      return;
    }
    const col = (title, arr) => `<div><div style="font-weight:700;color:var(--accent-gold);margin-bottom:6px">${title}</div>
      ${arr.map((p,i)=>`<div style="font-size:0.85rem;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">${i+1}. ${p.name} <span style="color:var(--text-muted)">${p.team||''}</span> — <b>${p.count}</b></div>`).join('')||'<span style="color:var(--text-muted)">—</span>'}</div>`;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${col('⚽ Golden Boot', g)}
        ${col('🎯 Assists', a)}
        ${col('⭐ MOTM', m)}
        ${col('🟨 Yellows', y)}
        ${col('🟥 Reds', r)}
        ${col('🧤 Saves', s)}
      </div>
      <div style="margin-top:10px;font-size:0.75rem;color:var(--text-muted)">Matchday ${globalMatchDay} · Full match engine · Injuries tracked</div>`;
  }

  function renderBracket() {
    const el = document.getElementById('bracket');
    if (!el || !tournament) return;
    if (!tournament.knockout || !tournament.knockout.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">No knockout matches yet.</p>';
      return;
    }
    const curIdx = tournament.knockout.length - 1;
    el.innerHTML = tournament.knockout.map((round, ri) => `
      <div class="round"><div class="round-title">${round.name}${round.twoLeg ? ' (two legs)' : ''}</div>
      ${round.matches.map((m, mi) => {
        const score = m.played
          ? (m.twoLeg !== false && m.aggHome != null
              ? `Agg ${m.aggHome}-${m.aggAway}`
              : `${m.homeScore} - ${m.awayScore}`)
          : '-';
        return `<div class="bracket-match ${m.played ? 'played' : ''}">
          <div class="bracket-team ${m.winner && m.winner.id === m.home.id ? 'winner' : ''}">
            <span>${m.home.flag || ''} ${m.home.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggHome != null ? m.aggHome : m.homeScore) : '-'}</span>
          </div>
          <div class="bracket-team ${m.winner && m.winner.id === m.away.id ? 'winner' : ''}">
            <span>${m.away.flag || ''} ${m.away.short}</span>
            <span class="bracket-score">${m.played ? (m.twoLeg !== false && m.aggAway != null ? m.aggAway : m.awayScore) : '-'}</span>
          </div>
          ${m.penalties ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">pens</div>' : ''}
          ${m.played && m.twoLeg !== false && m.aggHome != null ? '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center">' + score + '</div>' : ''}
          ${(!m.played && ri === curIdx && !tournament.champion) ? `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="App.simKnockoutMatch(${ri},${mi})">⚡ Instant</button>
          </div>` : ''}
          ${m.played ? `<button class="btn btn-secondary btn-sm" style="margin-top:6px;width:100%" onclick="App.viewKnockoutReport(${ri},${mi})">Match Report</button>` : ''}
        </div>`;
      }).join('')}
      </div>`).join('');
  }


  function simKnockoutMatch(roundIdx, matchIdx) {
    if (!tournament || !tournament.knockout[roundIdx]) return;
    const m = tournament.knockout[roundIdx].matches[matchIdx];
    if (!m || m.played) return;
    const round = tournament.knockout[roundIdx];
    const isFinal = round.name === 'Final' || round.matches.length === 1 || m.twoLeg === false;
    if (tournament.type === 'ucl' && !isFinal) simTwoLegTie(m);
    else if (isFinal) simSingleFinal(m);
    else {
      const result = simQuickMatch(m.home, m.away, { allowET: true, allowPens: true });
      m.homeScore = result.home; m.awayScore = result.away; m.played = true; m.report = result.report;
      if (result.pens) { m.penalties = true; m.winner = result.pens.home > result.pens.away ? m.home : m.away; }
      else if (result.home === result.away) { m.penalties = true; m.winner = Math.random() < 0.5 ? m.home : m.away; }
      else m.winner = result.home > result.away ? m.home : m.away;
    }
    afterKnockoutMatchPlayed(roundIdx);
  }

  function playKnockoutMatch(roundIdx, matchIdx) {
    if (!tournament || !tournament.knockout[roundIdx]) return;
    const m = tournament.knockout[roundIdx].matches[matchIdx];
    if (!m || m.played) return;
    window._koRoundIdx = roundIdx;
    window._koMatchIdx = matchIdx;
    window._tourFixtureIdx = null;
    switchView('match');
    const homeSel = document.getElementById('home-team');
    const awaySel = document.getElementById('away-team');
    if (homeSel) homeSel.value = m.home.id;
    if (awaySel) awaySel.value = m.away.id;
    updateTeamPreview('home'); updateTeamPreview('away');
    // Force ET + pens for knockout
    const et = document.getElementById('opt-et');
    const pens = document.getElementById('opt-pens');
    if (et) et.checked = true;
    if (pens) pens.checked = true;
    startMatch();
    toast('Knockout match — ET & pens enabled');
  }

  function afterKnockoutMatchPlayed(roundIdx) {
    const current = tournament.knockout[roundIdx];
    if (!current.matches.every(x => x.played)) {
      renderBracket();
      renderTournamentLeaderboard();
      return;
    }
    const winners = current.matches.map(m => m.winner).filter(Boolean);
    if (winners.length === 1) {
      setChampion(winners[0]);
      renderBracket();
      renderTournamentLeaderboard();
      return;
    }
    if (winners.length < 2) { renderBracket(); return; }
    // Don't add next if already exists beyond this round
    if (roundIdx < tournament.knockout.length - 1) {
      renderBracket();
      return;
    }
    let list = winners.slice();
    if (list.length % 2 === 1) list.pop();
    const nextIsFinal = list.length === 2;
    const nextMatches = [];
    for (let i = 0; i < list.length; i += 2) {
      if (tournament.type === 'ucl' && !nextIsFinal) {
        nextMatches.push(makeTwoLegTie(list[i], list[i+1]));
      } else if (tournament.type === 'ucl' && nextIsFinal) {
        nextMatches.push({
          home: list[i], away: list[i+1], twoLeg: false, played: false,
          homeScore: null, awayScore: null, winner: null, report: null
        });
      } else {
        nextMatches.push({
          home: list[i], away: list[i+1], homeScore: null, awayScore: null,
          winner: null, played: false
        });
      }
    }
    tournament.knockout.push({
      name: getRoundName(list.length),
      matches: nextMatches,
      twoLeg: tournament.type === 'ucl' && !nextIsFinal
    });
    const stageTitle = document.getElementById('tour-stage-title');
    if (stageTitle) stageTitle.textContent = getRoundName(list.length);
    renderBracket();
    renderTournamentLeaderboard();
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
      <div class="team-check" style="cursor:pointer;flex-direction:column;align-items:flex-start;gap:4px" onclick="App.showTeamProfile('${t.id}')">
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:1.5rem">${t.flag || ''}</span><strong>${t.name}</strong></div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${(t.players || []).length} players · ${t.short}</div>
        <div style="font-size:0.7rem;color:var(--accent-gold)">${(t.manager&&t.manager.name)||''}</div>
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

  
  function renderPostMatchRatings() {
    if (!currentMatch || !currentMatch.playerMatchStats) return;
    if (currentMatch.silentDeep) return;
    const el = document.getElementById('post-match-ratings');
    if (!el) return;
    const m = currentMatch;
    const entries = Object.values(m.playerMatchStats).sort((a,b) => b.rating - a.rating);
    let h = '<div class="card-title">Post-Match Ratings (' + entries.length + ' players)</div>';
    // Group by team
    const homeIds = new Set((m.home.squad.all||[]).map(p=>p.id));
    const homeP = entries.filter(p => homeIds.has(p.id));
    const awayP = entries.filter(p => !homeIds.has(p.id));
    const row = (p) => {
      const rc = p.rating >= 7.5 ? 'rating-high' : p.rating >= 6.5 ? 'rating-mid' : 'rating-low';
      const icons = (p.goals ? '⚽'.repeat(Math.min(p.goals,3)) : '') + (p.assists ? '🎯'.repeat(Math.min(p.assists,2)) : '');
      return `<div class="pm-player" onclick="App.showPlayerProfile('${p.id}')" style="cursor:pointer">
        <span class="player-num">${p.num||''}</span>
        <span style="flex:1;font-weight:600">${p.name}</span>
        <span>${icons}</span>
        <span class="xg">xG ${(p.xg||0).toFixed(2)} · xA ${(p.xa||0).toFixed(2)}</span>
        <span class="rating-badge ${rc}">${p.rating.toFixed(1)}</span>
      </div>`;
    };
    h += `<div style="font-size:0.8rem;color:var(--accent-gold);margin:8px 0 4px">${m.home.team.flag||''} ${m.home.team.name}</div>`;
    h += homeP.map(row).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>';
    h += `<div style="font-size:0.8rem;color:var(--accent-gold);margin:12px 0 4px">${m.away.team.flag||''} ${m.away.team.name}</div>`;
    h += awayP.map(row).join('') || '<div style="color:var(--text-muted);font-size:0.85rem">No data</div>';
    el.innerHTML = h;
    el.style.display = 'block';
  }

  function returnToTournament() {
    const backBtn = document.getElementById('back-to-tournament');
    if (backBtn) { backBtn.style.display = 'none'; backBtn.classList.remove('show'); }
    switchView('tournament');
    if (tournament) {
      renderGroups();
      if (tournament.stage === 'knockout') renderBracket();
    }
    toast('Back to tournament — results updated');
  }

  
  function showPlayerProfile(playerId) {
    let player = null, team = null;
    for (const t of allTeams) {
      const p = (t.players || []).find(x => x.id === playerId);
      if (p) { player = p; team = t; break; }
    }
    if (!player) { toast('Player not found'); return; }
    const g = (stats.goals[playerId] || {}).count || 0;
    const a = (stats.assists[playerId] || {}).count || 0;
    const s = (stats.saves[playerId] || {}).count || 0;
    const motm = (stats.motm[playerId] || {}).count || 0;
    const y = (stats.yellows[playerId] || {}).count || 0;
    const r = (stats.reds[playerId] || {}).count || 0;
    const primary = team.color || '#d4af37';
    const secondary = team.secondary || '#fff';
    const modal = document.getElementById('player-modal');
    const content = document.getElementById('player-modal-content');
    if (!modal || !content) return;
    content.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar" style="background:${primary};border:3px solid ${secondary};color:${secondary}">${player.num || '?'}</div>
        <div>
          <h2 style="margin:0 0 4px;font-size:1.2rem">${player.name}</h2>
          <div style="color:var(--text-secondary);font-size:0.85rem">${team.flag || ''} ${team.name} · ${(player.pos||[]).join('/')}</div>
          <div style="color:var(--accent-gold);font-weight:700;margin-top:4px">OVR ${player.ovr}</div>
        </div>
      </div>
      <div class="profile-stats-grid">
        <div class="profile-stat"><div class="val">${g}</div><div class="lbl">Goals</div></div>
        <div class="profile-stat"><div class="val">${a}</div><div class="lbl">Assists</div></div>
        <div class="profile-stat"><div class="val">${motm}</div><div class="lbl">MOTM</div></div>
        <div class="profile-stat"><div class="val">${s}</div><div class="lbl">Saves</div></div>
        <div class="profile-stat"><div class="val">${y}</div><div class="lbl">Yellows</div></div>
        <div class="profile-stat"><div class="val">${r}</div><div class="lbl">Reds</div></div>
      </div>
      <div style="margin-top:8px">
        ${[['ATT',player.att],['DEF',player.def],['PHY',player.phy],['PAC',player.pac],['TEC',player.tec]].map(([n,v]) => `
          <div class="attr-bar-row"><span class="attr-name">${n}</span>
            <div class="attr-track"><div class="attr-fill" style="width:${v||50}%"></div></div>
            <span class="attr-val">${v||'-'}</span></div>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('player-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }

  function showTeamProfile(teamId) {
    const team = getTeam(teamId);
    if (!team) { toast('Team not found'); return; }
    const primary = team.color || '#d4af37';
    const secondary = team.secondary || '#fff';
    const mgr = team.manager || {};
    const players = [...(team.players || [])].sort((a,b) => (b.ovr||0)-(a.ovr||0));
    const modal = document.getElementById('team-modal');
    const content = document.getElementById('team-modal-content');
    if (!modal || !content) return;
    content.innerHTML = `
      <div class="team-profile-banner" style="background:linear-gradient(135deg,${primary}33,${secondary}22);border:1px solid ${primary}55">
        <span style="font-size:2.5rem">${team.flag || ''}</span>
        <div>
          <h2 style="margin:0">${team.name}</h2>
          <div style="font-size:0.85rem;color:var(--text-secondary)">${team.short} · ${(team.players||[]).length} players</div>
          <div style="font-size:0.8rem;color:var(--accent-gold);margin-top:4px">Manager: ${mgr.name || '—'} (OVR ${mgr.ovr || '—'})</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <div style="width:28px;height:28px;border-radius:6px;background:${primary};border:2px solid ${secondary}"></div>
        <span style="font-size:0.8rem;color:var(--text-muted)">Primary / Secondary kit colors</span>
      </div>
      <div class="card-title">Squad</div>
      <div style="max-height:320px;overflow-y:auto">
        ${players.map(p => `
          <div class="team-roster-item" onclick="App.showPlayerProfile('${p.id}')">
            <span class="player-num">${p.num||''}</span>
            <span class="player-pos">${(p.pos||[])[0]||''}</span>
            <span style="flex:1;font-weight:600">${p.name}</span>
            <span class="player-ovr">${p.ovr}</span>
          </div>`).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="document.getElementById('team-modal').classList.remove('active')">Close</button></div>`;
    modal.classList.add('active');
  }

  function showAwards(type) {
    document.querySelectorAll('.award-tab').forEach(t => t.classList.toggle('active', t.dataset.award === type));
    const el = document.getElementById('awards-content');
    if (!el) return;
    if (type === 'goldenboot') {
      const data = Object.values(stats.goals || {}).sort((a,b) => b.count - a.count).slice(0, 15);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">⚽</div><p>No goals yet.</p></div>'; return; }
      el.innerHTML = '<div class="award-card"><div class="award-icon">👟</div><div class="award-info"><h4>Golden Boot</h4><p class="award-winner">' + data[0].name + ' (' + data[0].team + ') — ' + data[0].count + ' goals</p></div></div>' +
        '<table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Goals</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr><td class="lb-rank">'+(i+1)+'</td><td class="lb-player">'+p.name+'</td><td class="lb-team">'+p.team+'</td><td style="font-weight:700;color:var(--accent-gold)">'+p.count+'</td></tr>').join('') +
        '</tbody></table>';
    } else if (type === 'ballon') {
      // Ballon d'Or formula: goals*3 + assists*2 + motm*4 + ovr factor from stats
      const scores = {};
      Object.values(stats.goals||{}).forEach(p => { scores[p.id] = scores[p.id] || {id:p.id,name:p.name,team:p.team,pts:0}; scores[p.id].pts += p.count * 3; });
      Object.values(stats.assists||{}).forEach(p => { scores[p.id] = scores[p.id] || {id:p.id,name:p.name,team:p.team,pts:0}; scores[p.id].pts += p.count * 2; });
      Object.values(stats.motm||{}).forEach(p => { scores[p.id] = scores[p.id] || {id:p.id,name:p.name,team:p.team,pts:0}; scores[p.id].pts += p.count * 4; });
      Object.values(stats.saves||{}).forEach(p => { scores[p.id] = scores[p.id] || {id:p.id,name:p.name,team:p.team,pts:0}; scores[p.id].pts += p.count * 0.5; });
      const data = Object.values(scores).sort((a,b) => b.pts - a.pts).slice(0, 15);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🥇</div><p>Not enough data for Ballon d\'Or.</p></div>'; return; }
      el.innerHTML = '<div class="award-card"><div class="award-icon">🥇</div><div class="award-info"><h4>Ballon d\'Or Ranking</h4><p class="award-winner">' + data[0].name + ' (' + data[0].team + ') — ' + Math.round(data[0].pts) + ' pts</p></div></div>' +
        '<table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Points</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr><td class="lb-rank">'+(i+1)+'</td><td class="lb-player">'+p.name+'</td><td class="lb-team">'+p.team+'</td><td style="font-weight:700;color:var(--accent-gold)">'+Math.round(p.pts)+'</td></tr>').join('') +
        '</tbody></table>';
    } else if (type === 'puskas') {
      const data = Object.values(stats.puskas || {}).sort((a,b) => b.count - a.count).slice(0, 10);
      if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🏆</div><p>No Puskas-worthy goals yet. Score screamers!</p></div>'; return; }
      el.innerHTML = '<div class="award-card"><div class="award-icon">🏆</div><div class="award-info"><h4>Puskas Award</h4><p class="award-winner">' + data[0].name + ' (' + data[0].team + ') — ' + data[0].count + ' spectacular goals</p></div></div>' +
        '<table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Goals</th></tr></thead><tbody>' +
        data.map((p,i) => '<tr><td class="lb-rank">'+(i+1)+'</td><td class="lb-player">'+p.name+'</td><td class="lb-team">'+p.team+'</td><td style="font-weight:700;color:var(--accent-gold)">'+p.count+'</td></tr>').join('') +
        '</tbody></table>';
    } else if (type === 'trophies') {
      if (!trophies.length) { el.innerHTML = '<div class="empty-state"><div class="icon">🏆</div><p>No trophies won yet. Complete a tournament!</p></div>'; return; }
      el.innerHTML = trophies.map(t => '<div class="award-card"><div class="award-icon">🏆</div><div class="award-info"><h4>'+t.name+'</h4><p class="award-winner">'+t.team+'</p><p>'+t.type+'</p></div></div>').join('');
    } else {
      // overview
      const topScorer = Object.values(stats.goals||{}).sort((a,b)=>b.count-a.count)[0];
      const topAst = Object.values(stats.assists||{}).sort((a,b)=>b.count-a.count)[0];
      const topMotm = Object.values(stats.motm||{}).sort((a,b)=>b.count-a.count)[0];
      el.innerHTML = `
        <div class="award-card"><div class="award-icon">👟</div><div class="award-info"><h4>Golden Boot Leader</h4><p class="award-winner">${topScorer ? topScorer.name + ' — ' + topScorer.count + ' goals' : '—'}</p></div></div>
        <div class="award-card"><div class="award-icon">🎯</div><div class="award-info"><h4>Top Assists</h4><p class="award-winner">${topAst ? topAst.name + ' — ' + topAst.count : '—'}</p></div></div>
        <div class="award-card"><div class="award-icon">⭐</div><div class="award-info"><h4>Most MOTM</h4><p class="award-winner">${topMotm ? topMotm.name + ' — ' + topMotm.count : '—'}</p></div></div>
        <div class="award-card"><div class="award-icon">🏆</div><div class="award-info"><h4>Trophies</h4><p class="award-winner">${trophies.length} won</p></div></div>`;
    }
  }

  function goToSquadBuilder() {
    switchView('match');
    const setup = document.getElementById('match-setup');
    const live = document.getElementById('match-live');
    if (setup) setup.style.display = 'block';
    if (live) live.style.display = 'none';
    toast('Pick teams & formations, then Kick Off. Lineups are auto-built by formation.');
  }

  return {
    init, switchView, goToMatch, goToTournament, updateTeamPreview,
    startMatch, quickSimMatch, toggleSim, setSpeed, simToEnd, resetMatch,
    showLeaderboard, selectAllTeams, deselectAllTeams, startTournament,
    simTournamentRound, simAllTournament, resetTournament, filterTeams,
    showAwards, goToSquadBuilder, playTournamentMatch, simSingleFixture, returnToTournament, showPlayerProfile, showTeamProfile, randomMatch, resetLeaderboard, playKnockoutMatch, simKnockoutMatch, viewFixtureReport, viewKnockoutReport, showMatchReport, simUCLFixture, playUCLFixture, simPlayoffTie, viewPlayoffReport
  };
})();

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
