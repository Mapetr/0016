"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ColumnDef, getCoreRowModel } from "@tanstack/table-core";
import { Doc } from "@/convex/_generated/dataModel";
import { flexRender, useReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const columns: ColumnDef<Doc<"files">>[] = [
  {
    accessorKey: "url",
    header: "URL"
  },
  {
    accessorKey: "size",
    header: "Size"
  },
  {
    accessorKey: "Type",
    header: "Type"
  },
  {
    accessorKey: "_creationTime",
    header: "Created at"
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
