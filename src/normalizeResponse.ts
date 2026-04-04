import { AxiosResponse } from "axios";
import { MODELS } from "./extension";


export function normalizeResponse(response: AxiosResponse, llmModel: string) {
    if (llmModel === MODELS.QWEN_SMART || llmModel === MODELS.DEEPSEEK_SMART ||
        llmModel === MODELS.GENERAL
    ) {
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