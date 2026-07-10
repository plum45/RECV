import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;

function getOpenAiClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: apiKey || "dummy-key-for-build-pre-render",
    });
  }
  return openai;
}

export async function generateAnalysisReport(prompt: string): Promise<string> {
  if (!apiKey || apiKey === "your_openai_api_key") {
    throw new Error("OpenAI API key is not configured. Please set the OPENAI_API_KEY in your .env.local file.");
  }

  try {
    const client = getOpenAiClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Fast, accurate, and cost-effective
      messages: [
        {
          role: "system",
          content: "You are a professional financial trading AI assistant. Generate detailed technical analysis and trading setups in Thai, exactly following the requested markdown format template. Provide objective analysis based strictly on the provided quantitative data. Do not make up prices or assume real-time data unless supplied in the prompt.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for more analytical and structured output
      max_tokens: 3000,
    });

    return response.choices[0]?.message?.content || "No analysis report generated.";
  } catch (error: any) {
    console.error("OpenAI API error:", error.message);
    throw new Error(`OpenAI Analysis failed: ${error.message}`);
  }
}
