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
  /** What it is, shown in the card header ("IOT//..."); UAV when absent. */
  kind?: string;
  thumbnail: string;
  /** Card image for projects without a YouTube video. */
  image?: string;
  status: string;
  bom: string[];
  softwareStack: string[];
  description: string;
  specs: ProjectSpec;
  links?: ProjectLinks;
}

export async function getProjects(): Promise<Project[]> {
  return mockProjects as unknown as Project[];
}
