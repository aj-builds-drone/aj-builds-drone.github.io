import mockProjects from "@/data/mock-projects.json";

export interface ProjectSpec {
  [key: string]: string;
}

export interface ProjectLinks {
  [key: string]: string;
}

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  status: string;
  bom: string[];
  softwareStack: string[];
  description: string;
  specs: ProjectSpec;
  links?: ProjectLinks;
}

const RAW_GITHUB_URL =
  "https://raw.githubusercontent.com/ajayadesign/ajayadesign.github.io/main/aj-builds-drone/src/data/mock-projects.json";

export async function getProjects(): Promise<Project[]> {
  try {
    const res = await fetch(RAW_GITHUB_URL, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Remote fetch failed: ${res.status}`);
    const data: Project[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("Empty dataset");
    return data;
  } catch (err) {
    console.warn("[getProjects] Falling back to local data:", (err as Error).message);
    return mockProjects as unknown as Project[];
  }
}
