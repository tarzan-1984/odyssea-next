import AiLayout from "@/components/ai/AiLayout";
import AiPageBreadcrumb from "@/components/ai/AiPageBreadcrumb";
import ImageGeneratorContent from "@/components/ai/ImageGeneratorContent";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Odysseia Web",
	description:
		"This is  Next.js AI Image Generator page for TailAdmin - Next.js Tailwind CSS Admin Dashboard Template",
};

export default function page() {
	return (
		<div>
			<AiPageBreadcrumb pageTitle="Image Generator" />
			<AiLayout>
				<ImageGeneratorContent />
			</AiLayout>
		</div>
	);
}
