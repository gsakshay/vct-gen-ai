import BaseAppLayout from "../../../components/base-app-layout";
import Chat from "../../../components/chatbot/chat";

import { Link, useParams } from "react-router-dom";
import { Header, HelpPanel } from "@cloudscape-design/components";

export default function Playground()
{
  const { sessionId } = useParams();

  return (
    <BaseAppLayout
      toolsWidth={300}
      content={
        <Chat sessionId={sessionId} />
      }
    />
  );
}
