with open('src/modules/finance/components/Financial.tsx', 'r') as f:
    content = f.read()

target = 'className={}'
replacement = 'className={`aspect-square rounded-xl border-2 p-4 bg-white flex flex-col items-center justify-center text-center transition-all cursor-pointer ${isSelected ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/20 shadow-xs" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}'

if target in content:
    content = content.replace(target, replacement, 1)
    with open('src/modules/finance/components/Financial.tsx', 'w') as f:
        f.write(content)
    print('REPLACED FINALLY')
else:
    print('NOT FOUND IN FILE')
