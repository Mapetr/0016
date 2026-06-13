"use client";

import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { ColumnDef, getCoreRowModel } from "@tanstack/table-core";
import { Doc } from "@/convex/_generated/dataModel";
import { flexRender, useReactTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";

function DeleteButton({ file }: { file: Doc<"files"> }) {
  const deleteFile = useMutation(api.files.deleteFile);
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    if (!window.confirm("Delete this file? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteFile({ fileId: file._id });
      toast.success("File deleted");
    } catch {
      toast.error("Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={deleting}
      aria-label="Delete file"
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 />
    </Button>
  );
}

const columns: ColumnDef<Doc<"files">>[] = [
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      return (
        <Link
          className="block max-w-[300px] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-left [direction:rtl] hover:underline lg:max-w-[400px]"
          href={row.original.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {row.original.url}
        </Link>
      );
    },
  },
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => {
      return (
        <span className="whitespace-nowrap">
          {formatBytes(row.original.size)}
        </span>
      );
    },
  },
  {
    accessorKey: "Type",
    header: "Type",
    cell: ({ row }) => {
      return (
        <span className="block max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
          {row.original.type}
        </span>
      );
    },
  },
  {
    accessorKey: "_creationTime",
    header: "Created",
    cell: ({ row }) => {
      return (
        <span className="whitespace-nowrap">
          {new Date(row.original._creationTime).toLocaleDateString()}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      return (
        <div className="flex justify-end">
          <DeleteButton file={row.original} />
        </div>
      );
    },
  },
];

// Mobile card component for each file
function FileCard({ file }: { file: Doc<"files"> }) {
  const copyUrl = async () => {
    await navigator.clipboard.writeText(file.url);
    toast.success("Copied link to clipboard");
  };

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-base font-medium leading-tight hover:underline"
          >
            {file.url.split("/").pop() || file.url}
          </Link>
          <DeleteButton file={file} />
        </div>
        <p
          className="cursor-pointer break-all text-sm text-muted-foreground hover:underline"
          onClick={copyUrl}
        >
          {file.url}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{formatBytes(file.size)}</span>
          <span>{file.type || "Unknown type"}</span>
          <span>{new Date(file._creationTime).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 25;

export default function Page() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const {
    results: files,
    status,
    loadMore,
  } = usePaginatedQuery(api.files.getFiles, {}, { initialNumItems: PAGE_SIZE });
  const router = useRouter();

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load the next page when the sentinel scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && status === "CanLoadMore") {
          loadMore(PAGE_SIZE);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [status, loadMore]);

  if (isLoading) return null;
  if (!isLoading && !isAuthenticated) {
    router.push("/");
    return null;
  }

  const isEmpty = status !== "LoadingFirstPage" && files.length === 0;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-semibold sm:mb-6 sm:text-2xl">
        Your Files
      </h1>

      {/* Mobile view - Card layout */}
      <div className="block md:hidden">
        {files.length > 0 ? (
          <div className="flex flex-col">
            {files.map((file) => (
              <FileCard key={file._id} file={file} />
            ))}
          </div>
        ) : isEmpty ? (
          <p className="py-8 text-center text-base text-muted-foreground">
            No files uploaded yet.
          </p>
        ) : null}
      </div>

      {/* Desktop view - Table layout */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <DataTable columns={columns} data={files} />
          </div>
        </div>
      </div>

      {/* Infinite-scroll sentinel + loading indicator */}
      <div ref={sentinelRef} className="h-1" />
      {(status === "LoadingMore" || status === "LoadingFirstPage") && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      )}
    </div>
  );
}

function DataTable<TData, TValue>({
  columns,
  data,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              No files uploaded yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
