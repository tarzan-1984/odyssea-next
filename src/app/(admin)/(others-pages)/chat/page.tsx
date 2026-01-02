import ChatContainer from "@/components/chats/ChatContainer";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { ChatModalProvider } from "@/context/ChatModalContext";
import ChatPageClient from "./ChatPageClient";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Odysseia Web",
	description: "Odysseia Web Application - Chat",
};

export default function Chat() {
	return (
		<ChatModalProvider>
			<div>
				<PageBreadcrumb pageTitle="Chats" />
				<div className="h-[calc(100vh-150px)] overflow-hidden sm:h-[calc(100vh-174px)]">
					<ChatContainer />
				</div>
			</div>
			<ChatPageClient />
		</ChatModalProvider>
	);
}
