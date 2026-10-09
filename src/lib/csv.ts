// Rekap CSV untuk dibuka di Excel, Numbers, atau Google Sheets. Tanpa impor @/ supaya bisa diuji unit.

type Cell = string | number | null | undefined

// Isian yang diawali =, +, -, @, tab, atau carriage return bisa dijalankan Excel sebagai rumus, jadi diberi tanda kutip satu.
function safe(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function toCsv(rows: Cell[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = safe(cell)
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    )
    .join('\r\n')
}

// BOM membuat Excel membaca huruf seperti é dan ñ sebagai UTF-8.
export function downloadCsv(filename: string, rows: Cell[][]): void {
  const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
