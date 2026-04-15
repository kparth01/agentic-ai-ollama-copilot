import { AxiosResponse } from "axios";
import { MODELS } from "./extension";

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