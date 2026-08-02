import { chatCompletionJSON } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { structureResumeResultSchema } from "@/lib/ai/schemas";
import type { AIMode } from "@/lib/ai/types";
import type { FinalResume } from "@/types/resume";

export async function structureImportedResumeServer(
  text: string
): Promise<{ finalResume: FinalResume; mode: AIMode }> {
  const mode = getAIConfig().mode;
  if (mode === "mock") {
    return { finalResume: structureLocally(text), mode };
  }

  const result = await chatCompletionJSON({
    schema: structureResumeResultSchema,
    schemaName: "structured_imported_resume",
    temperature: 0,
    system:
      "你是严谨的中文简历结构化助手。只能提取输入中明确存在的信息，不得补写、猜测或夸大。缺失字段使用空字符串或空数组。",
    user: [
      "Extract only facts explicitly present in the resume text.",
      'Return exactly this JSON shape: {"finalResume":{"personalInfo":{"name":"","email":"","phone":"","location":""},"jobIntent":"","summary":"","coreSkills":[],"workExperience":[{"company":"","role":"","period":"","bullets":[]}],"projectExperience":[{"name":"","role":"","period":"","bullets":[]}],"skillsAndTools":[],"education":{"school":"","degree":"","period":""}}}',
      "Resume text:",
      text,
    ].join("\n\n"),
  });
  return { finalResume: result.finalResume, mode };
}

function structureLocally(text: string): FinalResume {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?86[- ]?)?1[3-9]\d{9}/)?.[0] ?? "";
  const nameCandidate = lines[0]?.split(/[|｜·]/)[0]?.trim() ?? "";
  return {
    personalInfo: {
      name: nameCandidate.length <= 12 ? nameCandidate : "",
      email,
      phone,
      location: "",
    },
    jobIntent: "",
    summary: lines.slice(1, 5).join(" ").slice(0, 300),
    coreSkills: [],
    workExperience: [],
    projectExperience: [],
    skillsAndTools: [],
    education: { school: "", degree: "", period: "" },
  };
}
