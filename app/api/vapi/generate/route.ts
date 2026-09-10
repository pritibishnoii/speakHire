import { generateObject } from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: Request) {
  const body = await request.json();
  console.log("Vapi Payload:", JSON.stringify(body, null, 2));
  
  const { searchParams } = new URL(request.url);
  let urlUserId = searchParams.get("userid");

  let params = body;
  let toolCallId;
  
  if (body.message?.toolWithToolCallList) {
    const toolCall = body.message.toolWithToolCallList[0].toolCall;
    params = toolCall.function.arguments;
    toolCallId = toolCall.id;
  } else if (body.message?.toolCalls) {
    params = body.message.toolCalls[0].function.arguments;
    toolCallId = body.message.toolCalls[0].id;
  }
  
  let { type, role, level, techstack, amount, userid } = params;

  if (!userid) userid = urlUserId;

  if (!userid && body.message?.call?.variableValues?.userid) {
    userid = body.message.call.variableValues.userid;
  }
  
  if (!techstack) techstack = "General";
  try {
    const { object: parsedQuestions } = await generateObject({
      model: google("gemini-3.6-flash"),
      schema: z.array(z.string()),
      prompt: `Prepare ${amount || 5} questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
    `,
    });

    const interview = {
      role: role,
      type: type || "Mixed",
      level: level,
      techstack: techstack.split(","),
      questions: parsedQuestions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    if (toolCallId) {
      return Response.json(
        {
          results: [
            {
              toolCallId,
              result: "Interview generated and saved successfully.",
            },
          ],
        },
        { status: 200 }
      );
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ success: false, error: error }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
