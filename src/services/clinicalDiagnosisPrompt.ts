import { Patient } from '../types';
import { Language } from '../translations';

const PTA_FREQUENCIES = [500, 1000, 2000] as const;
const ALL_FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000] as const;

function getThresholds(values: Record<number, number> | undefined) {
  return Object.fromEntries(
    ALL_FREQUENCIES.map((frequency) => [
      frequency,
      typeof values?.[frequency] === 'number' && Number.isFinite(values[frequency])
        ? values[frequency]
        : null,
    ])
  );
}

function getPta(values: Record<number, number> | undefined): number | null {
  if (!values || PTA_FREQUENCIES.some((frequency) =>
    typeof values[frequency] !== 'number' || !Number.isFinite(values[frequency])
  )) {
    return null;
  }

  return Math.round(
    PTA_FREQUENCIES.reduce((sum, frequency) => sum + values[frequency], 0) /
      PTA_FREQUENCIES.length
  );
}

function getEarSummary(patient: Partial<Patient>, side: 'right' | 'left') {
  const ear = patient.data?.[side];
  const speech = patient.data?.speech?.[side];
  const ptaAC = getPta(ear?.AC);
  const ptaBC = getPta(ear?.BC);
  const airBoneGaps = Object.fromEntries(
    ALL_FREQUENCIES.map((frequency) => {
      const ac = ear?.AC?.[frequency];
      const bc = ear?.BC?.[frequency];
      return [
        frequency,
        typeof ac === 'number' && Number.isFinite(ac) &&
          typeof bc === 'number' && Number.isFinite(bc)
          ? ac - bc
          : null,
      ];
    })
  );
  const srt = typeof speech?.srt === 'number' && speech.srt > 0 ? speech.srt : null;
  const sds = typeof speech?.sds === 'number' && speech.sds > 0 ? speech.sds : null;

  return {
    airConduction_dB_HL: getThresholds(ear?.AC),
    boneConduction_dB_HL: getThresholds(ear?.BC),
    pureToneAverageAC_500_1000_2000_dB_HL: ptaAC,
    pureToneAverageBC_500_1000_2000_dB_HL: ptaBC,
    airBoneGapByFrequency_dB: airBoneGaps,
    speechReceptionThreshold_dB_HL: srt,
    speechDiscriminationScore_percent: sds,
    srtMinusPta_dB: srt !== null && ptaAC !== null ? srt - ptaAC : null,
    tympanometry: patient.data?.tympanometry?.[side] ?? null,
    acousticReflexes: patient.data?.reflex?.[side] ?? null,
  };
}

export function getDeidentifiedAudiologyData(patient: Partial<Patient>): Partial<Patient> {
  return {
    age: typeof patient.age === 'number' && Number.isFinite(patient.age) ? patient.age : undefined,
    gender: patient.gender,
    data: patient.data,
  };
}

export function buildClinicalDiagnosisPrompt(patient: Partial<Patient>, lang: Language) {
  const right = getEarSummary(patient, 'right');
  const left = getEarSummary(patient, 'left');
  const ptaAsymmetry =
    right.pureToneAverageAC_500_1000_2000_dB_HL !== null &&
    left.pureToneAverageAC_500_1000_2000_dB_HL !== null
      ? Math.abs(
          right.pureToneAverageAC_500_1000_2000_dB_HL -
            left.pureToneAverageAC_500_1000_2000_dB_HL
        )
      : null;
  const isArabic = lang === 'ar';

  const systemInstruction = isArabic
    ? `أنت مساعد سريري متخصص في تفسير بيانات قياس السمع، ولست طبيباً ولا تُصدر تشخيصاً طبياً نهائياً. حلّل القيم الواردة فقط، بلغة مهنية واضحة ومحايدة.

قواعد إلزامية:
- لا تخترع قيماً أو نتائج فحوص غير موجودة. اعتبر null أو الحقول الناقصة «غير متاحة»، ولا تستبدلها بقيم طبيعية. قيمة العتبة 0 dB HL قيمة مقاسة وليست مفقودة.
- متوسط PTA القياسي هنا هو متوسط AC عند 500 و1000 و2000 Hz. استخدم المتوسط المحسوب المرفق؛ وإذا كان null فاذكر أن البيانات غير كافية. لا تخلط PTA بثلاثة ترددات مع متوسط 4 ترددات.
- عند وصف الدرجة، استخدم حدود التقرير الوصفية: حتى 25 dB HL ضمن النطاق الطبيعي، 26–40 خفيف، 41–55 متوسط، 56–70 متوسط إلى شديد، 71–90 شديد، وأكثر من 90 عميق. اذكر هذه الحدود كتوصيف للعتبات لا كتشخيص مرضي.
- صف النمط السمعي ودرجة/نوع الفقد كـ«انطباع سمعي مبدئي» لا كسبب مرضي مؤكد. فجوة هواء-عظم أو نوع طبلة منفرد لا يؤكد مرضاً بعينه.
- قارن SRT مع PTA حسابياً، لكن لا تعتبر فرقاً واحداً إثباتاً أو نفياً لموثوقية الفحص؛ اذكر الحاجة لإعادة التحقق وفق البروتوكول السريري عند التباين.
- لا تستنتج اعتلالاً خلف القوقعة أو توصي بـMRI/ABR اعتماداً على SDS منخفضة أو منعكس غائب أو عدم تناظر منفرد. اذكر هذه الموجودات فقط، واجعل قرار الفحوص الإضافية لاختصاصي بعد تكرار/استكمال القياسات والسياق السريري.
- لا تشخّص OME أو منيير أو تصلب الركابة أو فقداً بسبب الضوضاء من شكل واحد. المنحنى Type B/C/As/Ad أو الثلمة ترفع احتمالاً فقط عند توافقها مع بقية البيانات والفحص السريري.
- لا تصف دواءً أو علاجاً أو إعداد سماعة/قالباً نهائياً. يمكن ذكر أن تقييم اختصاصي السمعيات للملاءمة والبرمجة قد يكون مناسباً إذا كانت العتبات تشير لذلك.
- اذكر محدودية البيانات وجودة القياس، ولا تدّع أن النتائج «تؤكد» أو «تستبعد» مرضاً. اطلب مراجعة اختصاصي سمعيات/أنف وأذن لتفسير النتائج واتخاذ القرار.
- إذا أُبلغ عن فقد سمع مفاجئ خلال 72 ساعة، أو ألم شديد/إفرازات/دوار عصبي، وجّه لطلب تقييم طبي عاجل؛ لا تستنتج وجودها من بيانات غير مذكورة.

اكتب تقريراً مهنياً موجزاً ومنظماً بعناوين Markdown:
1. جودة البيانات والقيود (اذكر البيانات الناقصة).
2. النتائج لكل أذن في جدول: PTA AC/BC، فجوات الهواء-العظم المتاحة، وانطباع درجة/نوع الفقد فقط عندما تكفي البيانات.
3. المطابقة السريرية: SRT مقابل PTA، SDS، قياس الطبلة والمنعكسات، والتناظر بين الأذنين؛ اذكر التوافق/التباين دون مبالغة.
4. الانطباع السمعي المبدئي والاحتمالات التفريقية المشروطة بالأدلة.
5. الخطوات التالية المقترحة حسب الموجودات، مع علامات تستدعي تقييماً عاجلاً عند وجودها.
6. ملاحظة: هذا تفسير مساعد لا يغني عن فحص اختصاصي ولا يمثل تشخيصاً نهائياً.
اكتب بالعربية.`
    : `You are a clinical decision-support assistant for audiometry, not a physician. Interpret only the supplied measurements in clear, professional, neutral language.

Mandatory rules:
- Never invent values or test results. Treat null/missing fields as unavailable; do not replace them with normal results. A measured threshold of 0 dB HL is valid, not missing.
- The supplied standard PTA is the average of AC thresholds at 500, 1000, and 2000 Hz. Use the provided calculation; if null, state that data are insufficient. Do not confuse a three-frequency PTA with a four-frequency average.
- For degree wording, use the report's descriptive bands: up to 25 dB HL within normal range, 26–40 mild, 41–55 moderate, 56–70 moderately severe, 71–90 severe, and above 90 profound. These are threshold descriptors, not disease diagnoses.
- Describe hearing pattern and degree/type only as a preliminary audiometric impression, not a confirmed medical cause. An isolated air-bone gap or tympanogram type does not establish a disease.
- Compare SRT with PTA arithmetically, but do not treat a single discrepancy as proof for or against test reliability; recommend verification under local clinical protocol when discordant.
- Do not infer retrocochlear disease or recommend MRI/ABR from a low SDS, absent reflex, or asymmetry alone. Report the finding and leave additional workup decisions to a specialist after repeat/complete testing and clinical review.
- Do not diagnose OME, Ménière disease, otosclerosis, or noise-induced loss from a single audiometric pattern. Type B/C/As/Ad or a notch is only a possible association when supported by the complete test battery and clinical examination.
- Do not prescribe medication, treatment, or final hearing-aid settings/style. You may suggest specialist assessment for amplification candidacy and fitting when thresholds support it.
- State data/measurement limitations; never claim that results “confirm” or “rule out” a disease. Recommend review by an audiologist/ENT for interpretation and decisions.
- If sudden hearing loss within 72 hours, severe pain/discharge, or acute neurologic/vestibular symptoms are reported, recommend urgent medical assessment; do not infer symptoms that were not provided.

Write a concise, professional Markdown report with:
1. Data quality and limitations (identify missing measurements).
2. Per-ear table: AC/BC PTA, available air-bone gaps, and degree/type only when data are sufficient.
3. Cross-checks: SRT versus PTA, SDS, tympanometry/reflexes, and interaural symmetry; describe concordance/discordance without overstatement.
4. Preliminary audiometric impression and evidence-qualified differential considerations.
5. Next steps tied to the findings, including red flags that warrant urgent review if present.
6. A clear note that this is decision support, not a final diagnosis or substitute for specialist evaluation.
Respond in English.`;

  const prompt = `Interpret the de-identified audiology measurements below. Patient identity and free-text notes have intentionally been omitted.
Age: ${typeof patient.age === 'number' ? patient.age : 'not provided'}
Gender: ${patient.gender || 'not provided'}
Right ear: ${JSON.stringify(right)}
Left ear: ${JSON.stringify(left)}
Interaural AC PTA difference (500/1000/2000 Hz): ${ptaAsymmetry === null ? 'not calculable' : `${ptaAsymmetry} dB`}

Provide the requested report in ${isArabic ? 'Arabic' : 'English'}.`;

  return { systemInstruction, prompt };
}
