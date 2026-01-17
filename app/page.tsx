"use client";

import { FileUpload } from "@/components/FileUpload";
import { LinkShortener } from "@/components/LinkShortener";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center sm:min-h-[calc(100vh-4rem)]">
      <div className={"w-full px-3 py-4 sm:px-6 lg:px-8"}>
        <Tabs
          defaultValue="upload"
          className={"flex w-full flex-col items-center"}
        >
          <TabsList className={"mb-6 h-auto w-auto p-1 sm:mb-4"}>
            <TabsTrigger
              value="upload"
              className="px-4 py-2 text-base sm:px-3 sm:py-1.5 sm:text-sm"
            >
              File uploader
            </TabsTrigger>
            <TabsTrigger
              value="shortener"
              className="px-4 py-2 text-base sm:px-3 sm:py-1.5 sm:text-sm"
            >
              Link shortener
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="w-full max-w-4xl">
            <FileUpload />
          </TabsContent>
          <TabsContent value="shortener" className="w-full max-w-4xl">
            <LinkShortener />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
