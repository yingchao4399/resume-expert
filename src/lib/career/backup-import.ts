"use client";

import type { ResumeBackup } from "@/lib/backup/resume-backup";
import { remapCareerDomainForMerge, remapDocumentsClaimIds } from "@/lib/backup/resume-backup";
import { readCareerDomain, replaceCareerDomain } from "@/lib/career/career-db";
import { mergeCareerSnapshots } from "@/lib/career/migration";
import { projectClaimsToLegacyEvidence } from "@/lib/career/career-context";
import { mapResumeBullets } from "@/lib/evidence/resume-evidence";

export async function prepareCareerBackupImport(backup: ResumeBackup, mode: "merge" | "replace") {
  const before = await readCareerDomain();
  const remapped = mode === "merge" ? remapCareerDomainForMerge(backup.careerDomain) : { domain: backup.careerDomain, claimIdMap: new Map<string, string>() };
  const next = mode === "merge" ? mergeCareerSnapshots(before, remapped.domain) : remapped.domain;
  try {
    await replaceCareerDomain(next);
    return {
      documents: remapDocumentsClaimIds(backup.documents, remapped.claimIdMap),
      careerEvidence: projectClaimsToLegacyEvidence(remapped.domain),
      archives: backup.archives.map(archive => ({ ...archive, finalResume: mapResumeBullets(archive.finalResume, bullet => {
        const evidenceLinks = bullet.evidenceLinks.map(link => ({ ...link, evidenceId: remapped.claimIdMap.get(link.evidenceId) ?? link.evidenceId }));
        return { ...bullet, evidenceLinks, evidenceIds: evidenceLinks.map(link => link.evidenceId) };
      }) })),
      rollback: () => replaceCareerDomain(before),
    };
  } catch (error) {
    await replaceCareerDomain(before).catch(() => undefined);
    throw error;
  }
}
