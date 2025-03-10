"use client";

import { FileUpload } from "@/components/FileUpload";
import { LinkShortener } from "@/components/LinkShortener";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";

export default function Home() {
  return (
    <main>
      <div className={"flex justify-center items-center mx-8 min-h-screen"}>
        <Tabs defaultValue="upload" className={"flex flex-col items-center"}>
          <TabsList className={"w-min"}>
            <TabsTrigger value="upload">File uploader</TabsTrigger>
            <TabsTrigger value="shortener">Link shortener</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <FileUpload />
          </TabsContent>
          <TabsContent value="shortener">
            <LinkShortener />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
