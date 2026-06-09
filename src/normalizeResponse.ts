import { AxiosResponse } from "axios";
import { MODELS } from "./extension";


export interface NormalizedResponse {
  role: string;
  content: string;
  actions?: import('./agentParser').AgentAction[];
}

export function normalizeResponse(response: AxiosResponse, llmModel: string) {
    if (Object.values(MODELS).includes(llmModel)) {
        const confirm = response.data?.message?.content;
        let parsed: any;

        try {
            parsed = JSON.parse(confirm);
        } catch {
            parsed = null;
        }

        return parsed;
    }
}