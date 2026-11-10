import { AudiometryData, Patient } from '../types';
import { Language } from '../translations';

const FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000] as const;
const PTA_FREQUENCIES = [500, 1000, 2000] as const;
const REFLEX_FREQUENCIES = [500, 1000, 2000, 4000] as const;
type EarSide = 'right' | 'left';

interface EarSummary {
  side: EarSide;
  ac: Record<number, number>;
  bc: Record<number, number>;
  ptaAc: number | null;
  ptaBc: number | null;
  gaps: Array<{ frequency: number; gap: number }>;
  significantGaps: Array<{ frequency: number; gap: number }>;
  meanGap: number | null;
}

function isMeasurement(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatValue(value: number | null | undefined, unit = ''): string {
  return isMeasurement(value) ? `${value}${unit}` : '—';
}

function getPta(values: Record<number, number> | undefined): number | null {
  if (!values || PTA_FREQUENCIES.some((frequency) => !isMeasurement(values[frequency]))) {
    return null;
  }
  return Math.round(
    PTA_FREQUENCIES.reduce((sum, frequency) => sum + values[frequency], 0) / PTA_FREQUENCIES.length
  );
}

function getEarSummary(data: AudiometryData, side: EarSide): EarSummary {
  const { AC: ac = {}, BC: bc = {} } = data[side] ?? { AC: {}, BC: {} };
  const gaps = FREQUENCIES.flatMap((frequency) => {
    const air = ac[frequency];
    const bone = bc[frequency];
    return isMeasurement(air) && isMeasurement(bone)
      ? [{ frequency, gap: air - bone }]
      : [];
  });
  const significantGaps = gaps.filter(({ gap }) => gap >= 15);
  const ptaGaps = gaps.filter(({ frequency }) => PTA_FREQUENCIES.includes(frequency as 500 | 1000 | 2000));

  return {
    side,
    ac,
    bc,
    ptaAc: getPta(ac),
    ptaBc: getPta(bc),
    gaps,
    significantGaps,
    meanGap: ptaGaps.length === PTA_FREQUENCIES.length
      ? Math.round(ptaGaps.reduce((sum, item) => sum + item.gap, 0) / ptaGaps.length)
      : null,
  };
}

function degreeLabel(pta: number, lang: Language): string {
  if (lang === 'ar') {
    if (pta <= 25) return 'ضمن النطاق الطبيعي لمتوسط PTA';
    if (pta <= 40) return 'خفيف';
    if (pta <= 55) return 'متوسط';
    if (pta <= 70) return 'متوسط إلى شديد';
    if (pta <= 90) return 'شديد';
    return 'عميق';
  }
  if (pta <= 25) return 'within the normal PTA range';
  if (pta <= 40) return 'mild';
  if (pta <= 55) return 'moderate';
  if (pta <= 70) return 'moderately severe';
  if (pta <= 90) return 'severe';
  return 'profound';
}

function patternLabel(ear: EarSummary, lang: Language): string {
  if (ear.ptaAc === null || ear.ptaBc === null || ear.meanGap === null) {
    return lang === 'ar'
      ? 'لا تكفي القياسات المكتملة لتحديد نمط النوع؛ يلزم استكمال AC وBC عند 500 و1000 و2000 هرتز.'
      : 'Insufficient complete thresholds to classify pattern; AC and BC at 500, 1000, and 2000 Hz are needed.';
  }
  if (ear.ptaAc <= 25 && ear.ptaBc <= 25) {
    return lang === 'ar'
      ? 'متوسطا AC وBC ضمن النطاق الطبيعي؛ لا ينفي ذلك وجود تغير عند تردد منفرد.'
      : 'AC and BC averages are within the normal range; this does not exclude an isolated-frequency change.';
  }
  if (ear.meanGap >= 15 && ear.ptaBc <= 25) {
    return lang === 'ar'
      ? 'نمط عتبات يتضمن مكوّناً توصيلياً محتملاً؛ يحتاج ربطاً بقياس الطبلة والفحص السريري.'
      : 'Threshold pattern includes a possible conductive component; correlate with tympanometry and examination.';
  }
  if (ear.meanGap >= 15 && ear.ptaBc > 25) {
    return lang === 'ar'
      ? 'نمط عتبات قد يجمع مكوّناً حسياً عصبياً وفجوة هواء-عظم؛ يلزم التحقق من القياسات.'
      : 'Threshold pattern may include both sensorineural elevation and an air-bone gap; verify measurements.';
  }
  if (ear.ptaBc > 25) {
    return lang === 'ar'
      ? 'النمط متوافق مع ارتفاع العتبات العظمية (مكوّن حسي عصبي محتمل)، وليس تحديداً لسبب طبي.'
      : 'Pattern is consistent with elevated bone thresholds (possible sensorineural component), not a medical cause.';
  }
  return lang === 'ar'
    ? 'العتبات الهوائية أعلى من النطاق الطبيعي مع متوسط عظمي غير مرتفع؛ راجع فجوات الترددات وقياس الطبلة.'
    : 'Air thresholds are above the normal range with a non-elevated bone average; review frequency-specific gaps and tympanometry.';
}

function getTympanometryText(data: AudiometryData, side: EarSide, lang: Language): string {
  const tymp = data.tympanometry?.[side];
  if (!tymp) return lang === 'ar' ? 'غير مسجل.' : 'Not recorded.';

  const values = [
    `Type ${tymp.type || '—'}`,
    `${lang === 'ar' ? 'الضغط' : 'pressure'} ${formatValue(tymp.pressure, ' daPa')}`,
    `${lang === 'ar' ? 'المطاوعة' : 'compliance'} ${formatValue(tymp.compliance, ' ml')}`,
    `${lang === 'ar' ? 'حجم القناة' : 'canal volume'} ${formatValue(tymp.volume, ' ml')}`,
    isMeasurement(tymp.gradient) ? `${lang === 'ar' ? 'التدرج' : 'gradient'} ${tymp.gradient}` : null,
  ].filter(Boolean).join(' · ');

  const type = tymp.type?.trim().toUpperCase();
  const note = lang === 'ar'
    ? type === 'B'
      ? 'النمط المسطح Type B يحتاج تفسيراً مع حجم القناة والفحص؛ لا يحدد السبب بمفرده.'
      : type === 'C'
        ? 'Type C يعكس ضغطاً سلبياً وقت القياس؛ لا يثبت وحده وجود مرض محدد.'
        : type === 'AS'
          ? 'Type As يشير إلى مطاوعة منخفضة نسبياً؛ يفسر مع بقية الفحوص.'
          : type === 'AD'
            ? 'Type Ad يشير إلى مطاوعة مرتفعة نسبياً؛ يفسر مع بقية الفحوص.'
            : type === 'A'
              ? 'شكل Type A ضمن النمط المعتاد للضغط؛ لا ينفي كل اضطرابات الأذن.'
              : 'يُفسر نوع المنحنى بحسب القيم والفحص السريري.'
    : type === 'B'
      ? 'A flat Type B pattern needs interpretation with canal volume and examination; it does not identify a cause alone.'
      : type === 'C'
        ? 'Type C reflects negative pressure at testing; it does not establish a specific disease.'
        : type === 'AS'
          ? 'Type As indicates relatively shallow compliance; correlate with the rest of the test battery.'
          : type === 'AD'
            ? 'Type Ad indicates relatively high compliance; correlate with the rest of the test battery.'
            : type === 'A'
              ? 'Type A is the usual pressure pattern; it does not rule out every ear disorder.'
              : 'Interpret the curve type alongside the measurements and clinical examination.';

  return `${values}. ${note}`;
}

function formatReflexValue(value: unknown, lang: Language): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value} dB`;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^(nr|no response)$/i.test(trimmed)) {
      return lang === 'ar' ? 'NR (لم يُسجل رد)' : 'NR (no response)';
    }
    return trimmed;
  }
  return null;
}

function getReflexText(data: AudiometryData, side: EarSide, lang: Language): string {
  const earReflex = data.reflex?.[side];
  const tympReflex = data.tympanometry?.[side]?.reflex1kIpsi;
  const entries = REFLEX_FREQUENCIES.flatMap((frequency) => {
    const ipsi = formatReflexValue(earReflex?.ipsi?.[frequency], lang);
    const contra = formatReflexValue(earReflex?.contra?.[frequency], lang);
    const items = [];
    if (ipsi) items.push(`${frequency} Hz ${lang === 'ar' ? 'مباشر' : 'ipsi'}: ${ipsi}`);
    if (contra) items.push(`${frequency} Hz ${lang === 'ar' ? 'مقابل' : 'contra'}: ${contra}`);
    return items;
  });
  const tympValue = formatReflexValue(tympReflex, lang);
  if (tympValue) {
    entries.push(`${lang === 'ar' ? 'منعكس الطبلة 1 kHz' : 'Tympanometric 1 kHz reflex'}: ${tympValue}`);
  }
  return entries.length
    ? entries.join(' · ')
    : lang === 'ar' ? 'لم تُسجل قيم المنعكسات.' : 'Reflex measurements not recorded.';
}

function getSpeechText(data: AudiometryData, ear: EarSummary, lang: Language): string {
  const speech = data.speech?.[ear.side];
  if (!speech) return lang === 'ar' ? 'غير مسجل.' : 'Not recorded.';
  const srt = isMeasurement(speech.srt) && speech.srt > 0 ? speech.srt : null;
  const sds = isMeasurement(speech.sds) && speech.sds > 0 ? speech.sds : null;
  if (srt === null && sds === null) return lang === 'ar' ? 'غير مسجل.' : 'Not recorded.';

  const findings = [];
  if (srt !== null) {
    findings.push(`${lang === 'ar' ? 'SRT' : 'SRT'} ${srt} dB HL`);
    if (ear.ptaAc !== null) {
      const difference = srt - ear.ptaAc;
      findings.push(
        `${lang === 'ar' ? 'فرق SRT−PTA' : 'SRT−PTA difference'} ${difference > 0 ? '+' : ''}${difference} dB`
      );
      if (Math.abs(difference) > 10) {
        findings.push(lang === 'ar'
          ? 'التباين ملحوظ ويستحق التحقق من ظروف وطريقة القياس.'
          : 'The discrepancy merits checking test conditions and measurement method.');
      }
    }
  }
  if (sds !== null) findings.push(`SDS ${sds}%`);
  return findings.join(' · ');
}

function describeAudiogramShape(ear: EarSummary, lang: Language): string {
  const low = [500, 1000].map((frequency) => ear.ac[frequency]).filter(isMeasurement);
  const high = [4000, 8000].map((frequency) => ear.ac[frequency]).filter(isMeasurement);
  if (!low.length || !high.length) {
    return lang === 'ar' ? 'لا توجد بيانات كافية لوصف شكل المنحنى.' : 'Insufficient data to describe audiogram contour.';
  }
  const delta = Math.round(high.reduce((a, b) => a + b, 0) / high.length -
    low.reduce((a, b) => a + b, 0) / low.length);
  if (delta >= 20) {
    return lang === 'ar'
      ? `انحدار ملحوظ للعتبات العالية مقارنة بمتوسط 500–1000 Hz (فرق وصفي ${delta} dB). هذا وصف للشكل وليس دليلاً على السبب.`
      : `High-frequency thresholds are elevated versus 500–1000 Hz (descriptive difference ${delta} dB); contour alone does not establish cause.`;
  }
  if (delta <= -20) {
    return lang === 'ar'
      ? `العتبات المنخفضة أعلى من العالية (فرق وصفي ${Math.abs(delta)} dB)؛ النمط وحده لا يحدد سبباً مرضياً.`
      : `Low-frequency thresholds are higher than high-frequency thresholds (descriptive difference ${Math.abs(delta)} dB); contour alone does not determine cause.`;
  }
  return lang === 'ar'
    ? 'لا يظهر فرق كبير بين متوسط عتبات الترددات العالية والمنخفضة في القيم المتاحة.'
    : 'No large difference is seen between available high- and low-frequency averages.';
}

function earLabel(side: EarSide, lang: Language): string {
  if (lang !== 'ar') return side === 'right' ? 'Right' : 'Left';
  return side === 'right' ? 'اليمنى' : 'اليسرى';
}

export function buildLocalAudiologyReport(patient: Partial<Patient>, lang: Language = 'ar'): string {
  const isArabic = lang === 'ar';
  if (!patient.data) {
    return isArabic
      ? '## تعذر إعداد التحليل المحلي\nلا توجد بيانات فحوص سمعية لهذه الزيارة. أدخل نتائج الفحوص ثم أعد المحاولة.'
      : '## Local analysis unavailable\nNo audiology test data are available for this visit. Enter test results and try again.';
  }

  const data = patient.data;
  const ears = [getEarSummary(data, 'right'), getEarSummary(data, 'left')];
  const labels = {
    title: isArabic ? '## تحليل سمعي محلي قائم على القواعد' : '## Local Rule-Based Audiology Analysis',
    disclaimer: isArabic
      ? '> أُعد هذا التقرير داخل التطبيق دون الاتصال بمزود ذكاء اصطناعي. وهو تحليل آلي للقياسات وليس تشخيصاً طبياً نهائياً.'
      : '> Generated in-app without an AI provider. This is a rule-based interpretation of measurements, not a final medical diagnosis.',
    data: isArabic ? '### 1. القياسات وجودة البيانات' : '### 1. Measurements and data completeness',
    ear: isArabic ? '### 2. نتائج كل أذن' : '### 2. Ear-by-ear findings',
    cross: isArabic ? '### 3. مطابقة الفحوص' : '### 3. Test cross-checks',
    impression: isArabic ? '### 4. الانطباع السمعي المبدئي' : '### 4. Preliminary audiometric impression',
    recommendations: isArabic ? '### 5. خطوات المتابعة' : '### 5. Suggested follow-up',
    limits: isArabic ? '### 6. حدود هذا التحليل' : '### 6. Interpretation limits',
  };

  const rows = ears.map((ear) => {
    const earName = earLabel(ear.side, lang);
    const table = FREQUENCIES.map((frequency) => {
      const gap = ear.gaps.find((item) => item.frequency === frequency)?.gap;
      return `| ${frequency} | ${formatValue(ear.ac[frequency])} | ${formatValue(ear.bc[frequency])} | ${formatValue(gap)} |`;
    }).join('\n');
    const tympanometry = getTympanometryText(data, ear.side, lang);
    const speech = getSpeechText(data, ear, lang);
    const reflex = getReflexText(data, ear.side, lang);
    const pta = ear.ptaAc === null
      ? (isArabic ? 'غير قابل للحساب: يلزم AC عند 500 و1000 و2000 Hz.' : 'Not calculable: AC at 500, 1000, and 2000 Hz is required.')
      : `${ear.ptaAc} dB HL (${degreeLabel(ear.ptaAc, lang)})`;
    const ptaBc = ear.ptaBc === null
      ? (isArabic ? 'غير قابل للحساب' : 'Not calculable')
      : `${ear.ptaBc} dB HL`;
    const gapSummary = ear.significantGaps.length
      ? ear.significantGaps.map(({ frequency, gap }) => `${frequency} Hz: ${gap} dB`).join('، ')
      : isArabic ? 'لا توجد فجوة ≥15 dB في الترددات المكتملة' : 'No ≥15 dB gap among complete frequencies';
    return `#### ${earName}${isArabic ? ' (AD/AS)' : ' ear'}
| ${isArabic ? 'التردد (Hz)' : 'Frequency (Hz)'} | AC (dB HL) | BC (dB HL) | ${isArabic ? 'فجوة AC−BC (dB)' : 'ABG AC−BC (dB)'} |
|---:|---:|---:|---:|
${table}
- PTA AC (500/1000/2000 Hz): ${pta}; PTA BC: ${ptaBc}.
- ${isArabic ? 'الفجوات المحسوبة ≥15 dB' : 'Calculated gaps ≥15 dB'}: ${gapSummary}.
- ${isArabic ? 'شكل المنحنى' : 'Audiogram contour'}: ${describeAudiogramShape(ear, lang)}
- ${isArabic ? 'قياس الطبلة' : 'Tympanometry'}: ${tympanometry}
- ${isArabic ? 'قياس الكلام' : 'Speech'}: ${speech}
- ${isArabic ? 'المنعكسات الصوتية' : 'Acoustic reflexes'}: ${reflex}`;
  }).join('\n\n');

  const rightPta = ears[0].ptaAc;
  const leftPta = ears[1].ptaAc;
  const asymmetry = rightPta !== null && leftPta !== null
    ? Math.abs(rightPta - leftPta)
    : null;
  const noise = isMeasurement(patient.ambientNoise) && patient.ambientNoise > 0
    ? `${patient.ambientNoise} dB`
    : isArabic ? 'غير مسجل' : 'not recorded';
  const crossChecks = asymmetry === null
    ? isArabic
      ? 'تعذر حساب فرق PTA بين الأذنين بسبب نقص العتبات.'
      : 'Interaural PTA difference could not be calculated because thresholds are incomplete.'
    : isArabic
      ? `فرق PTA الهوائي بين الأذنين ${asymmetry} dB. هذا مؤشر وصفي؛ يفسَّر مع الفروق عند كل تردد، وسياق الحالة، وتكرار القياس.`
      : `Interaural AC PTA difference is ${asymmetry} dB. This is descriptive and should be interpreted with frequency-specific differences, clinical context, and repeat testing.`;

  const localRecommendations = ears.flatMap((ear) => {
    const name = earLabel(ear.side, lang);
    const recommendations: string[] = [];
    if (ear.significantGaps.length >= 2 || data.tympanometry?.[ear.side]?.type?.toUpperCase() === 'B' ||
      data.tympanometry?.[ear.side]?.type?.toUpperCase() === 'C') {
      recommendations.push(isArabic
        ? `تقييم اختصاصي أنف وأذن وحنجرة و/أو سمعيات لـ${name} وربط فجوات الهواء-العظم/قياس الطبلة بالفحص السريري.`
        : `Consider audiology/ENT review for the ${name.toLowerCase()} ear to correlate air-bone gaps/tympanometry with examination.`);
    }
    if (ear.ptaAc !== null && ear.ptaAc > 25) {
      recommendations.push(isArabic
        ? `مناقشة تقييم السمع والتأهيل/ملاءمة المعينات لدى اختصاصي السمعيات لـ${name}.`
        : `Discuss hearing rehabilitation and amplification candidacy for the ${name.toLowerCase()} ear with an audiologist.`);
    }
    if (ear.ptaAc !== null && ear.ptaBc !== null && ear.meanGap === null) {
      recommendations.push(isArabic
        ? `استكمال قياسات BC عند ترددات PTA لـ${name} لتفسير النوع بصورة أفضل.`
        : `Complete bone-conduction thresholds at PTA frequencies for the ${name.toLowerCase()} ear to improve pattern interpretation.`);
    }
    return recommendations;
  });
  if (!localRecommendations.length) {
    localRecommendations.push(isArabic
      ? 'مراجعة التقرير مع اختصاصي السمعيات، وإعادة الفحص إذا كانت النتائج لا تتوافق مع الأعراض.'
      : 'Review with an audiologist and repeat testing if results do not match symptoms.');
  }

  return `${labels.title}
${labels.disclaimer}

${labels.data}
- ${isArabic ? 'متوسط PTA محسوب من عتبات التوصيل الهوائي عند 500 و1000 و2000 Hz. الشرطة (—) تعني أن القيمة غير مسجلة.' : 'PTA uses air-conduction thresholds at 500, 1000, and 2000 Hz. A dash (—) means no value was recorded.'}
- ${isArabic
    ? 'القيم مأخوذة كما حُفظت في النموذج؛ تحقّق من إدخال القيم الافتراضية أو مراجعتها قبل اعتماد التقرير كقياسات فعلية.'
    : 'Values are read as saved in the form; verify default or prefilled fields before treating them as measured results.'}
- ${isArabic ? 'الضوضاء المحيطة أثناء القياس' : 'Ambient test noise'}: ${noise}.

${labels.ear}
${rows}

${labels.cross}
- ${crossChecks}
- ${isArabic
    ? 'تُعرض قيم SRT وSDS والمنعكسات كما أُدخلت. تباين SRT مع PTA أو انخفاض SDS/غياب المنعكس يستدعي مراجعة جودة وظروف القياس، ولا يشخّص وحده آفة عصبية.'
    : 'SRT, SDS, and reflex values are reported as entered. SRT/PTA discordance or low SDS/absent reflex merits measurement-quality review; none alone diagnoses neural pathology.'}

${labels.impression}
${ears.map((ear) => `- ${earLabel(ear.side, lang)}: ${ear.ptaAc === null
    ? (isArabic ? 'بيانات PTA غير مكتملة؛ لا يمكن تقدير الدرجة.' : 'PTA data are incomplete; degree cannot be estimated.')
    : `${isArabic ? 'درجة العتبات بحسب PTA' : 'PTA threshold descriptor'}: ${degreeLabel(ear.ptaAc, lang)}. ${patternLabel(ear, lang)}`}`).join('\n')}

${labels.recommendations}
${localRecommendations.map((item) => `- ${item}`).join('\n')}
- ${isArabic
    ? 'إذا وُجد فقد سمع مفاجئ خلال 72 ساعة أو تدهور سريع، فاطلب تقييماً طبياً عاجلاً. لا يمكن لهذا التقرير كشف الأعراض غير المدخلة.'
    : 'Sudden hearing loss within 72 hours or rapid deterioration warrants urgent medical assessment. This report cannot detect symptoms that were not entered.'}

${labels.limits}
- ${isArabic
    ? 'التصنيف نمطي مبني على العتبات المسجلة فقط؛ قياس الطبلة والمنعكسات ودرجات الكلام تعتمد على بروتوكول الجهاز وظروف الاختبار. لا يحدد التقرير سبب المشكلة ولا يوصي بتصوير أو دواء. القرار النهائي لاختصاصي السمعيات/الطبيب.'
    : 'Classifications are patterns based only on recorded thresholds; tympanometry, reflexes, and speech scores depend on equipment protocol and test conditions. This report does not determine cause or prescribe imaging/medication. Final interpretation belongs to an audiologist/clinician.'}`;
}

export function buildLocalAudiologyAdvice(patient: Partial<Patient>, lang: Language = 'ar'): string {
  const isArabic = lang === 'ar';
  if (!patient.data) {
    return isArabic
      ? 'لا توجد بيانات فحوص كافية لإعداد إرشادات مخصصة. أدخل نتائج الفحوص وراجع اختصاصي السمعيات.'
      : 'There are not enough test results for tailored guidance. Enter measurements and consult an audiologist.';
  }

  const ears = [getEarSummary(patient.data, 'right'), getEarSummary(patient.data, 'left')];
  const abnormalPta = ears.filter((ear) => ear.ptaAc !== null && ear.ptaAc > 25);
  const guidance = [
    isArabic
      ? 'احمِ السمع من الضوضاء العالية، وخفّض مستوى السماعات وخذ فترات راحة.'
      : 'Protect hearing from loud noise, keep headphone volume moderate, and take listening breaks.',
    abnormalPta.length
      ? isArabic
        ? `ناقش نتائج العتبات (${abnormalPta.map((ear) => `${earLabel(ear.side, lang)} ${ear.ptaAc} dB HL`).join('، ')}) مع اختصاصي السمعيات لتقييم التواصل وخيارات التأهيل.`
        : `Discuss threshold results (${abnormalPta.map((ear) => `${earLabel(ear.side, lang)} ${ear.ptaAc} dB HL`).join(', ')}) with an audiologist to review communication needs and rehabilitation options.`
      : isArabic
        ? 'إذا استمرت صعوبة فهم الكلام رغم PTA ضمن النطاق الطبيعي، اطلب تقييماً سمعياً إضافياً.'
        : 'If speech understanding remains difficult despite PTA in the normal range, request further audiological assessment.',
    isArabic
      ? 'أعد التقييم حسب توصية اختصاصي السمعيات، أو مبكراً إذا تغير السمع أو ظهرت أعراض جديدة.'
      : 'Repeat assessment as advised by your audiologist, or sooner if hearing changes or new symptoms appear.',
  ];
  return `### ${isArabic ? 'إرشادات محلية مبدئية' : 'Preliminary local guidance'}\n${guidance.map((item) => `- ${item}`).join('\n')}\n\n${isArabic
    ? 'هذه إرشادات عامة وليست تشخيصاً أو وصفة علاجية.'
    : 'This is general guidance, not a diagnosis or treatment prescription.'}`;
}
