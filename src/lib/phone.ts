/**
 * Keeps a mobile input to at most 10 digits while typing.
 * Handles pasted numbers like "+91 98765 43210" or "098765 43210"
 * by dropping the country code / leading 0 first.
 */
export function tenDigits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  else if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}
