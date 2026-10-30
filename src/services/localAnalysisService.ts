import { Patient, AudiometryData } from '../types';
import { analyzeHearing } from './hearingAnalysis';
import { translations, Language } from '../translations';

export const getLocalDiagnosis = (patient: Partial<Patient>, lang: Language = 'ar'): string => {
  if (!patient.data) return '';

  const t = translations[lang];
  const analysis = analyzeHearing(patient.data);
  const isRTL = lang === 'ar';

  const ears = [
    { side: 'right', name: t.rightEar, analysis: analysis.right, data: patient.data.right, tymp: patient.data.tympanometry?.right, speech: patient.data.speech?.right, reflex: patient.data.reflex?.right },
    { side: 'left', name: t.leftEar, analysis: analysis.left, data: patient.data.left, tymp: patient.data.tympanometry?.left, speech: patient.data.speech?.left, reflex: patient.data.reflex?.left },
  ];

  let report = isRTL ? `التقرير التشخيصي المفصل للسيد/ة ${patient.name || '---'}:\n\n` : `Detailed Diagnostic Report for ${patient.name || '---'}:\n\n`;

  // 1. Summary
  report += isRTL ? `1. ملخص النتائج (Findings Summary)\n` : `1. Findings Summary\n`;
  
  ears.forEach(ear => {
    report += `${ear.name}:\n`;
    
    // Thresholds
    const typeStr = t[ear.analysis.type as keyof typeof t] || ear.analysis.type;
    const degreeStr = t[ear.analysis.degree as keyof typeof t] || ear.analysis.degree;
    
    if (isRTL) {
      report += `- عتبات السمع: ضعف سمع ${degreeStr} (${ear.analysis.pta} dB).\n`;
    } else {
      report += `- Hearing Thresholds: ${degreeStr} hearing loss (${ear.analysis.pta} dB).\n`;
    }

    // Tympanometry
    if (ear.tymp) {
      if (isRTL) {
        report += `- تخطيط الطبلة: من النوع (${ear.tymp.type})، بضغط ${ear.tymp.pressure} daPa وحجم قناة ${ear.tymp.volume} ml.\n`;
        if (ear.tymp.type === 'B') report += `  * ملاحظة: النوع B يشير غالباً لوجود سوائل خلف الطبلة.\n`;
        if (ear.tymp.type === 'C') report += `  * ملاحظة: النوع C يشير لخلل في ضغط قناة استاكيوس.\n`;
      } else {
        report += `- Tympanometry: Type (${ear.tymp.type}), pressure: ${ear.tymp.pressure} daPa, volume: ${ear.tymp.volume} ml.\n`;
      }
    }

    // Speech
    if (ear.speech) {
      if (isRTL) {
        report += `- نتائج الكلام: SRT هو ${ear.speech.srt} dB، وSDS هو ${ear.speech.sds}%.\n`;
        if (ear.speech.sds < 70) report += `  * ملاحظة: تراجع ملحوظ في تمييز الكلام قد يستدعي فحوصات عصبية.\n`;
      } else {
        report += `- Speech Results: SRT: ${ear.speech.srt} dB, SDS: ${ear.speech.sds}%.\n`;
      }
    }
    report += `\n`;
  });

  // 2. Conclusion
  report += isRTL ? `2. التشخيص النهائي (Diagnostic Conclusion)\n` : `2. Diagnostic Conclusion\n`;
  ears.forEach(ear => {
    const typeStr = t[ear.analysis.type as keyof typeof t] || ear.analysis.type;
    const degreeStr = t[ear.analysis.degree as keyof typeof t] || ear.analysis.degree;
    if (isRTL) {
      report += `- ${ear.name}: ضعف سمع ${typeStr} بدرجة ${degreeStr}.\n`;
    } else {
      report += `- ${ear.name}: ${degreeStr} ${typeStr} hearing loss.\n`;
    }
  });
  report += `\n`;

  // 3. Recommendations
  report += isRTL ? `3. التوصيات السريرية (Clinical Recommendations)\n` : `3. Clinical Recommendations\n`;
  
  let needsENT = false;
  let needsMRI = false;
  
  ears.forEach(ear => {
    if (ear.tymp?.type === 'B' || ear.tymp?.type === 'C' || ear.analysis.type === 'conductiveHL' || ear.analysis.type === 'mixedHL') needsENT = true;
    if (ear.speech && ear.speech.sds < 60) needsMRI = true;
  });

  if (isRTL) {
    if (needsENT) report += `- استشارة طبيب أنف وأذن وحنجرة (ENT) لتقييم الأذن الوسطى.\n`;
    if (needsMRI) report += `- إجراء أشعة رنين مغناطيسي (MRI) لاستبعاد مسببات خلف القوقعة في العصب السمعي.\n`;
    report += `- إعادة الفحص بعد أي تدخل طبي للمراقبة.\n`;
  } else {
    if (needsENT) report += `- Consult an ENT specialist for middle ear evaluation.\n`;
    if (needsMRI) report += `- MRI might be needed to rule out retrocochlear pathology.\n`;
    report += `- Re-evaluation after medical treatment.\n`;
  }
  report += `\n`;

  // 4. Hearing Aids
  report += isRTL ? `4. نصيحة بشأن السماعات الطبية (Hearing Aid Advice)\n` : `4. Hearing Aid Advice\n`;
  ears.forEach(ear => {
    if (ear.analysis.pta > 30) {
      if (isRTL) {
        if (ear.analysis.pta > 70) {
          report += `- ${ear.name}: يفضل سماعة خلف الأذن قوية (Super Power BTE).\n`;
        } else {
          report += `- ${ear.name}: يمكن استخدام سماعة RIC أو BTE حسب شكل القناة.\n`;
        }
      } else {
        report += `- ${ear.name}: Hearing aid recommended (${ear.analysis.pta > 70 ? 'Power BTE' : 'RIC/BTE'}).\n`;
      }
    }
  });

  report += isRTL ? `\nمع تمنياتنا لك بالصحة والعافية.\n` : `\nWishing you health and wellness.\n`;

  return report;
};

export interface ConservationProfileSummary {
  factors: string[];
  hasHighFreqDrop: boolean;
  hasMiddleEarIssue: boolean;
  hasSpeechDifficulty: boolean;
  hasAsymmetry: boolean;
  needsAmplification: boolean;
}

export const extractPatientConservationFactors = (
  patient: Partial<Patient>,
  lang: Language = 'ar'
): ConservationProfileSummary => {
  if (!patient.data) {
    return {
      factors: [],
      hasHighFreqDrop: false,
      hasMiddleEarIssue: false,
      hasSpeechDifficulty: false,
      hasAsymmetry: false,
      needsAmplification: false,
    };
  }

  const isRTL = lang === 'ar';
  const t = translations[lang];
  const analysis = analyzeHearing(patient.data);
  const rAC = patient.data.right?.AC || {};
  const lAC = patient.data.left?.AC || {};
  const rTymp = patient.data.tympanometry?.right;
  const lTymp = patient.data.tympanometry?.left;
  const rSpeech = patient.data.speech?.right;
  const lSpeech = patient.data.speech?.left;

  const rHigh = Math.max(rAC[4000] ?? 0, rAC[8000] ?? 0);
  const lHigh = Math.max(lAC[4000] ?? 0, lAC[8000] ?? 0);
  const hasHighFreqDrop =
    rHigh >= 30 ||
    lHigh >= 30 ||
    (rAC[4000] ?? 0) - (rAC[1000] ?? 0) >= 15 ||
    (lAC[4000] ?? 0) - (lAC[1000] ?? 0) >= 15;

  const hasMiddleEarIssue =
    analysis.right.type === 'conductiveHL' ||
    analysis.right.type === 'mixedHL' ||
    analysis.left.type === 'conductiveHL' ||
    analysis.left.type === 'mixedHL' ||
    (rTymp?.type !== undefined && rTymp.type !== 'A') ||
    (lTymp?.type !== undefined && lTymp.type !== 'A');

  const rSds = rSpeech?.sds ?? 0;
  const lSds = lSpeech?.sds ?? 0;
  const hasSpeechDifficulty =
    (rSds > 0 && rSds < 84) ||
    (lSds > 0 && lSds < 84) ||
    analysis.right.pta > 35 ||
    analysis.left.pta > 35;

  const hasAsymmetry = Math.abs(analysis.right.pta - analysis.left.pta) >= 15;
  const needsAmplification = analysis.right.pta > 25 || analysis.left.pta > 25;

  const factors: string[] = [];
  const rDegree = t[analysis.right.degree as keyof typeof t] || analysis.right.degree;
  const lDegree = t[analysis.left.degree as keyof typeof t] || analysis.left.degree;

  factors.push(
    isRTL
      ? `الأذن اليمنى: ${rDegree} (${analysis.right.pta} dB)`
      : `Right: ${rDegree} (${analysis.right.pta} dB)`
  );
  factors.push(
    isRTL
      ? `الأذن اليسرى: ${lDegree} (${analysis.left.pta} dB)`
      : `Left: ${lDegree} (${analysis.left.pta} dB)`
  );

  if (hasHighFreqDrop) {
    factors.push(
      isRTL
        ? `انخفاض الترددات العالية (4k–8k Hz: ${Math.max(rHigh, lHigh)} dB)`
        : `High-Freq 4k–8k Drop (${Math.max(rHigh, lHigh)} dB)`
    );
  }

  if (hasMiddleEarIssue) {
    const tympSummary = `R:${rTymp?.type || 'A'}/L:${lTymp?.type || 'A'}`;
    factors.push(
      isRTL
        ? `تأثر الأذن الوسطى (${tympSummary})`
        : `Middle-Ear Factor (${tympSummary})`
    );
  }

  if (hasAsymmetry) {
    factors.push(
      isRTL
        ? `عدم تناظر سمعي (${Math.abs(analysis.right.pta - analysis.left.pta)} dB)`
        : `Interaural Asymmetry (${Math.abs(analysis.right.pta - analysis.left.pta)} dB)`
    );
  }

  return {
    factors,
    hasHighFreqDrop,
    hasMiddleEarIssue,
    hasSpeechDifficulty,
    hasAsymmetry,
    needsAmplification,
  };
};

export const getLocalPatientAdvice = (patient: Partial<Patient>, lang: Language = 'ar'): string => {
  if (!patient.data) return '';

  const isRTL = lang === 'ar';
  const analysis = analyzeHearing(patient.data);
  const profile = extractPatientConservationFactors(patient, lang);
  const rTymp = patient.data.tympanometry?.right;
  const lTymp = patient.data.tympanometry?.left;
  const rAC = patient.data.right?.AC || {};
  const lAC = patient.data.left?.AC || {};
  const max4k8k = Math.max(rAC[4000] ?? 0, rAC[8000] ?? 0, lAC[4000] ?? 0, lAC[8000] ?? 0);

  if (isRTL) {
    let md = `### 1. حماية السمع والوقاية من الضوضاء (Acoustic & Noise Protection)\n`;
    if (profile.hasHighFreqDrop) {
      md += `- **حماية الترددات العالية (4000–8000 Hz)**: يظهر تخطيطك السمعي حساسية في النغمات العالية (تصل إلى **${max4k8k} dB HL**)، لذا يُوصى بتجنب التعرض للأصوات الصاخبة التي تتجاوز **80 dB** واستخدام سدادات أذن واقية مفلترة (NRR 20–25 dB) في البيئات المزدحمة أو الصناعية.\n`;
    } else {
      md += `- **الحفاظ على الاحتياطي القوقعي السليم**: للحفاظ على عتبات السمع الحالية (اليمنى **${analysis.right.pta} dB** · اليسرى **${analysis.left.pta} dB**)، تجنب التعرض المستمر للضجيج العالي فوق **85 dB**.\n`;
    }
    md += `- **قاعدة 60/60 للسماعات الشخصية**: عند استخدام سماعات الرأس أو الأذن، لا تتجاوز **60%** من مستوى الصوت الأقصى لمدة لا تزيد عن **60 دقيقة** متواصلة، مع تفضيل السماعات العازلة للضوضاء (ANC) بدلاً من رفع الصوت.\n`;
    md += `- **فترة الراحة السمعية**: امنح أذنيك فترة هدوء تام لمدة 15–20 دقيقة بعد التواجد في أي مناسبة أو مكان مرتفع الضوضاء.\n\n`;

    md += `### 2. العناية اليومية بالأذن والأذن الوسطى (Daily Ear & Middle-Ear Hygiene)\n`;
    if (profile.hasMiddleEarIssue) {
      const hasTypeB = rTymp?.type === 'B' || lTymp?.type === 'B';
      const hasTypeC = rTymp?.type === 'C' || lTymp?.type === 'C';
      if (hasTypeB) {
        md += `- **العناية بضغط الطبلة والسوائل (Type B)**: نظراً لوجود مؤشرات تجمع سوائل أو تسطح في منحنى الطبلة، يُنصح بتجنب دخول الماء تماماً إلى قناة الأذن أثناء الاستحمام أو السباحة، ومتابعة العلاج الطبي لتصريف الاحتقان الأنفي.\n`;
      } else if (hasTypeC) {
        md += `- **تنظيم ضغط قناة استاكيوس (Type C)**: تشير قراءة ضغط الأذن الوسطى إلى ضغط سلبي؛ احرص على معالجة حساسية الجيوب الأنفية، وتجنب السفر الجوي أو الغوص أثناء نزلات البرد الحادة.\n`;
      } else {
        md += `- **مراقبة التوصيل السمعي**: نظراً لوجود فجوة توصيلية أو تغير في مرونة غشاء الطبل، تجنب إدخال أي أجسام صلبة أو قطرات غير موصوفة طبياً.\n`;
      }
    } else {
      md += `- **سلامة قناة الأذن وغشاء الطبل (Type A)**: وظيفة الأذن الوسطى ضمن الحدود الطبيعية؛ حافظ عليها بتجفيف الأذن الخارجية بلطف بمنشفة ناعمة فقط بعد الاستحمام.\n`;
    }
    md += `- **الامتناع التام عن أعواد القطن**: تنظف الأذن نفسها ذاتياً؛ استخدام الأعواد القطنية يدفع الشمع للداخل نحو الطبلة وقد يسبب سداداً توصيلياً أو خدوشاً في القناة.\n`;
    md += `- **الحذر من الأدوية السامة للسمع (Ototoxic Medications)**: استشر طبيبك دائماً قبل تناول المسكنات بجرعات عالية أو المضادات الحيوية الوريدية وأبلغه بملفك السمعي.\n\n`;

    md += `### 3. استراتيجيات التواصل الفعال والتأهيل السمعي (Communication & Listening Tips)\n`;
    if (profile.needsAmplification || profile.hasSpeechDifficulty) {
      md += `- **تحسين بيئة المحادثة وتمييز الكلام**: اجلس بحيث يكون مصدر الإضاءة خلفك ووجه المتحدث واضحاً أمامك للاستفادة من الإشارات البصرية وحركة الشفاه، مع تقليل الضوضاء الخلفية (كالتلفاز) أثناء الحديث.\n`;
      md += `- **الاستخدام المنتظم للمعينات السمعية**: مع متوسط عتبات (**${analysis.right.pta} dB** يمنى / **${analysis.left.pta} dB** يسرى)، فإن الالتزام بارتداء السماعات الطبية المبرمجة يومياً يحفز المسارات العصبية السمعية ويمنع تراجع نسبة تمييز الكلام (SDS).\n`;
    } else {
      md += `- **تخفيف الإجهاد السمعي في البيئات الصاخبة**: في الاجتماعات أو الأماكن المفتوحة، اختر الجلوس بعيداً عن مكبرات الصوت ومصادر الصدى للحفاظ على وضوح الكلام بأقل مجهود ذهني.\n`;
    }
    if (profile.hasAsymmetry) {
      md += `- **مراعاة التفاوت بين الأذنين**: وجه الأذن ذات العتبة الأفضل نحو المتحدث في الأماكن المزدحمة، مع الحرص على تنشيط الأذن الأخرى وفق توصية أخصائي السمعيات.\n`;
    }
    md += `\n`;

    md += `### 4. جدول المتابعة الدورية والمؤشرات التحذيرية (Follow-Up & Red Flags)\n`;
    md += `- **الفحص السمعي الدوري**: يُوصى بإعادة تخطيط السمع وضغط الطبلة كل **${profile.hasMiddleEarIssue ? '3 إلى 6 أشهر' : '6 إلى 12 شهراً'}** لمقارنة استقرار العتبات في الخط الزمني للمريض.\n`;
    md += `- **مؤشرات تستدعي مراجعة فورية**: راجع العيادة فوراً في حال ظهور طنين مفاجئ أو مستمر، شعور بامتلاء الأذن، دوار، أو تراجع مفاجئ في السمع خلال 24–48 ساعة.\n`;

    return md;
  } else {
    let md = `### 1. Acoustic & Noise Protection\n`;
    if (profile.hasHighFreqDrop) {
      md += `- **High-Frequency Cochlear Protection (4000–8000 Hz)**: Your audiogram indicates elevated high-frequency thresholds (up to **${max4k8k} dB HL**). Avoid sustained noise exposure above **80 dB** and wear high-fidelity filtered earplugs (NRR 20–25 dB) around loud machinery, concerts, or power tools.\n`;
    } else {
      md += `- **Preserve Baseline Cochlear Reserve**: To protect your current pure-tone averages (Right **${analysis.right.pta} dB HL** · Left **${analysis.left.pta} dB HL**), limit exposure to environments exceeding **85 dB**.\n`;
    }
    md += `- **Follow the 60/60 Listening Rule**: Keep personal audio devices at or below **60% maximum volume** for no more than **60 minutes** at a time. Prefer noise-canceling headphones over raising volume in noisy transit.\n`;
    md += `- **Auditory Recovery Breaks**: Give your ears 15–20 minutes of quiet recovery time following any prolonged loud acoustic environment.\n\n`;

    md += `### 2. Daily Ear Hygiene & Middle-Ear Care\n`;
    if (profile.hasMiddleEarIssue) {
      const hasTypeB = rTymp?.type === 'B' || lTymp?.type === 'B';
      const hasTypeC = rTymp?.type === 'C' || lTymp?.type === 'C';
      if (hasTypeB) {
        md += `- **Middle-Ear Fluid & Pressure Precautions (Type B)**: Because tympanometry suggests reduced tympanic mobility or middle-ear effusion, keep the ear canal strictly dry during showering/swimming and follow prescribed ENT nasal/middle-ear therapy.\n`;
      } else if (hasTypeC) {
        md += `- **Eustachian Tube Pressure Care (Type C)**: Negative middle-ear pressure is present; manage nasal allergies promptly and avoid rapid barometric changes (flying or diving) when congested.\n`;
      } else {
        md += `- **Conductive Pathway Protection**: Given the air-bone gap or tympanic compliance findings, avoid unprescribed ear drops or mechanical canal instrumentation.\n`;
      }
    } else {
      md += `- **Maintain Healthy Tympanic Function (Type A)**: Your middle-ear admittance is within normal limits. Simply dry the outer pinna gently with a towel after bathing.\n`;
    }
    md += `- **Avoid Cotton Swabs & Canal Insertion**: The ear canal is self-cleaning. Inserting swabs pushes cerumen deeper against the tympanic membrane and risks conductive impaction or abrasion.\n`;
    md += `- **Ototoxic Medication Awareness**: Inform prescribing physicians of your hearing profile before starting high-dose NSAIDs, loop diuretics, or aminoglycoside antibiotics.\n\n`;

    md += `### 3. Communication & Listening Strategies\n`;
    if (profile.needsAmplification || profile.hasSpeechDifficulty) {
      md += `- **Optimize Speech-in-Noise Clarity**: Position yourself with good lighting on the speaker's face to integrate visual lip-reading cues, and minimize background noise sources during conversations.\n`;
      md += `- **Consistent Auditory Stimulation**: With PTA thresholds of **${analysis.right.pta} dB** (Right) and **${analysis.left.pta} dB** (Left), consistent daily use of prescribed amplification helps preserve central speech discrimination (SDS) and reduces listening fatigue.\n`;
    } else {
      md += `- **Reduce Listening Effort in Complex Acoustics**: In restaurants or reverberant rooms, sit with your back toward walls or soft furnishings to improve the signal-to-noise ratio.\n`;
    }
    if (profile.hasAsymmetry) {
      md += `- **Interaural Asymmetry Positioning**: Favor your better-hearing ear toward speakers in group settings while following your audiologist's rehabilitation plan for the poorer ear.\n`;
    }
    md += `\n`;

    md += `### 4. Conservation Monitoring & Red Flags\n`;
    md += `- **Routine Audiometric Follow-Up**: Schedule a repeat pure-tone and immittance evaluation every **${profile.hasMiddleEarIssue ? '3 to 6 months' : '6 to 12 months'}** to track threshold stability on your longitudinal timeline.\n`;
    md += `- **Urgent Clinical Red Flags**: Seek prompt audiological or ENT evaluation if you experience sudden hearing changes within 24–48 hours, new unilateral tinnitus, aural fullness, or vertigo.\n`;

    return md;
  }
};

