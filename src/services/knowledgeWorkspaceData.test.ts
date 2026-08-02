import { describe, expect, it, vi } from "vitest";
import {
  loadKnowledgeEntryData,
  loadSourceEntryData,
  loadSourceSupportingData,
  loadTopicMaintenanceData,
} from "./knowledgeWorkspaceData";

function createRepository() {
  return {
    listSourceArchive: vi.fn().mockResolvedValue([{ id: 1 }]),
    listSourceCollections: vi.fn().mockResolvedValue([{ id: 2 }]),
    listDomains: vi.fn().mockResolvedValue([{ id: 3 }]),
    listTopics: vi.fn().mockResolvedValue([{ id: 4 }]),
    getPersonalCatalogProposal: vi.fn().mockResolvedValue({ version: "v1" }),
    listTopicAliases: vi.fn().mockResolvedValue([{ id: 5 }]),
    listEntities: vi.fn().mockResolvedValue([{ id: 6 }]),
    listClassificationRules: vi.fn().mockResolvedValue([{ id: 7 }]),
  };
}

describe("knowledge workspace entry data ownership", () => {
  it("keeps the source click path limited to the lightweight archive", async () => {
    const repository = createRepository();

    await expect(loadSourceEntryData(repository as never, 120)).resolves.toEqual({
      inbox: [{ id: 1 }],
    });

    expect(repository.listSourceArchive).toHaveBeenCalledWith(120);
    expect(repository.listDomains).not.toHaveBeenCalled();
    expect(repository.listTopics).not.toHaveBeenCalled();
    expect(repository.getPersonalCatalogProposal).not.toHaveBeenCalled();
    expect(repository.listTopicAliases).not.toHaveBeenCalled();
    expect(repository.listEntities).not.toHaveBeenCalled();
    expect(repository.listClassificationRules).not.toHaveBeenCalled();
  });

  it("loads source filters separately from the first paint", async () => {
    const repository = createRepository();

    await loadSourceSupportingData(repository as never);

    expect(repository.listDomains).toHaveBeenCalledTimes(1);
    expect(repository.listTopics).toHaveBeenCalledTimes(1);
    expect(repository.listSourceCollections).toHaveBeenCalledTimes(1);
    expect(repository.getPersonalCatalogProposal).not.toHaveBeenCalled();
  });

  it("keeps knowledge reading light and topic maintenance complete", async () => {
    const readingRepository = createRepository();
    await loadKnowledgeEntryData(readingRepository as never);
    expect(readingRepository.listDomains).toHaveBeenCalledTimes(1);
    expect(readingRepository.listTopics).toHaveBeenCalledTimes(1);
    expect(readingRepository.listTopicAliases).not.toHaveBeenCalled();

    const maintenanceRepository = createRepository();
    await loadTopicMaintenanceData(maintenanceRepository as never);
    expect(maintenanceRepository.getPersonalCatalogProposal).toHaveBeenCalledTimes(1);
    expect(maintenanceRepository.listTopicAliases).toHaveBeenCalledTimes(1);
    expect(maintenanceRepository.listEntities).toHaveBeenCalledTimes(1);
    expect(maintenanceRepository.listClassificationRules).toHaveBeenCalledTimes(1);
  });
});
