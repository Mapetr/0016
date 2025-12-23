"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ColumnDef, getCoreRowModel } from "@tanstack/table-core";
import { Doc } from "@/convex/_generated/dataModel";
import { flexRender, useReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { formatBytes } from "@/lib/utils";

const columns: ColumnDef<Doc<"files">>[] = [
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      return (
        <Link className="cursor-pointer hover:underline overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] text-left max-w-32 sm:max-w-64 md:max-w-full block" href={row.original.url} target="_blank" rel="noopener noreferrer">{row.original.url}</Link>
      )
    }
  },
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => {
      return formatBytes(row.original.size);
    }
  },
  {
    accessorKey: "Type",
    header: "Type",
    cell: ({ row }) => {
      return row.original.type;
    }
  },
  {
    accessorKey: "_creationTime",
    header: "Created at",
    cell: ({ row }) => {
      return new Date(row.original._creationTime).toLocaleString();
    }
  }
];

export default function Page() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const files = useQuery(api.files.getFiles);
  const router = useRouter();
  if (isLoading) return null;
  if (!isLoading && !isAuthenticated) {
    router.push("/");
    return null;
  }

  return (
    <div className={"xl:border rounded-xl"}>
      <DataTable columns={columns} data={files ?? []} />
    </div>
  );
}

function DataTable<TData, TValue>({
                                    columns,
                                    data
                                  }: {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null
                    : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                </TableHead>
              );
            })}
          </TableRow>
        )))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className={"h-24 text-center"}>
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
