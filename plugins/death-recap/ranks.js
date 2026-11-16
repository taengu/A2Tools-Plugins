// The Abyss ranks by grade (the meter's abyssGrade, 2.1.0 on): 1 Supreme
// Commander to 19 Trainee, in each language, from the game's own text
// (String_Title_rank_grade_abyss_<n>; zh-Hans from the Taiwan client's).
const ABYSS_RANKS = {
  en: ["Supreme Commander", "Commander", "Marshal", "General", "5-Star Officer", "4-Star Officer", "3-Star Officer", "2-Star Officer", "1-Star Officer", "First-Class Soldier", "Second-Class Soldier", "Third-Class Soldier", "Fourth-Class Soldier", "Fifth-Class Soldier", "Sixth-Class Soldier", "Seventh-Class Soldier", "Eighth-Class Soldier", "Ninth-Class Soldier", "Trainee"],
  ko: ["총사령관", "사령관", "대장군", "장군", "5성장교", "4성장교", "3성장교", "2성장교", "1성장교", "1급병", "2급병", "3급병", "4급병", "5급병", "6급병", "7급병", "8급병", "9급병", "훈련병"],
  ja: ["総司令官", "司令官", "大将軍", "将軍", "五星将校", "四星将校", "三星将校", "二星将校", "一星将校", "一等兵", "二等兵", "三等兵", "四等兵", "五等兵", "六等兵", "七等兵", "八等兵", "九等兵", "訓練兵"],
  de: ["Oberbefehlshaber", "Kommandant", "Großgeneral", "General", "5-Sterne-Offizier", "4-Sterne-Offizier", "3-Sterne-Offizier", "2-Sterne-Offizier", "1-Stern-Offizier", "Rang-1-Soldat", "Rang-2-Soldat", "Rang-3-Soldat", "Rang-4-Soldat", "Rang-5-Soldat", "Rang-6-Soldat", "Rang-7-Soldat", "Rang-8-Soldat", "Rang-9-Soldat", "Rekrut"],
  fr: ["Commandant suprême", "Commandant général", "Général en chef", "Général", "Officier 5 étoiles", "Officier 4 étoiles", "Officier 3 étoiles", "Officier 2 étoiles", "Officier 1 étoile", "Soldat de 1re classe", "Soldat de 2e classe", "Soldat de 3e classe", "Soldat de 4e classe", "Soldat de 5e classe", "Soldat de 6e classe", "Soldat de 7e classe", "Soldat de 8e classe", "Soldat de 9e classe", "Nouvelle recrue"],
  es: ["Comandante supremo", "Comandante general", "Caudillo", "General", "Capitán general", "Almirante general", "Almirante", "Vicealmirante", "Contraalmirante", "Soldado de 1.º", "Soldado de 2.º", "Soldado de 3.º", "Soldado de 4.º", "Soldado de 5.º", "Soldado de 6.º", "Soldado de 7.º", "Soldado de 8.º", "Soldado de 9.º", "Aprendiz"],
  pt: ["Comandante Supremo", "Comandante", "Marechal", "General", "Oficial de 5 Estrelas", "Oficial de 4 Estrelas", "Oficial de 3 Estrelas", "Oficial de 2 Estrelas", "Oficial de 1 Estrela", "Soldado Classe 1", "Soldado Classe 2", "Soldado Classe 3", "Soldado Classe 4", "Soldado Classe 5", "Soldado Classe 6", "Soldado Classe 7", "Soldado Classe 8", "Soldado Classe 9", "Recruta"],
  ru: ["Главнокомандующий", "Командующий", "Великий генерал", "Генерал", "Офицер 5-го ранга", "Офицер 4-го ранга", "Офицер 3-го ранга", "Офицер 2-го ранга", "Офицер 1-го ранга", "Воин 1-го ранга", "Воин 2-го ранга", "Воин 3-го ранга", "Воин 4-го ранга", "Воин 5-го ранга", "Воин 6-го ранга", "Воин 7-го ранга", "Воин 8-го ранга", "Воин 9-го ранга", "Новобранец"],
  "zh-Hant": ["總司令官", "司令官", "大將軍", "將軍", "5星軍官", "4星軍官", "3星軍官", "2星軍官", "1星軍官", "1等兵", "2等兵", "3等兵", "4等兵", "5等兵", "6等兵", "7等兵", "8等兵", "9等兵", "訓練兵"],
  "zh-Hans": ["总司令官", "司令官", "大将军", "将军", "5星军官", "4星军官", "3星军官", "2星军官", "1星军官", "1等兵", "2等兵", "3等兵", "4等兵", "5等兵", "6等兵", "7等兵", "8等兵", "9等兵", "训练兵"],
};
// A grade's name, or "" for none.
const rankName = (grade, lang) => {
  const g = Number(grade);
  if (!(g >= 1 && g <= 19)) return "";
  return (ABYSS_RANKS[lang] || ABYSS_RANKS[String(lang).split("-")[0]] || ABYSS_RANKS.en)[g - 1] || "";
};
