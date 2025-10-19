import { getTranslations } from 'next-intl/server'
import { ChangelogContent } from './changelog-content'

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/mengxi-ream/read-frog/main/apps'

async function getChangelogContent(type: 'extension' | 'website') {
  const url = `${GITHUB_RAW_BASE}/${type}/CHANGELOG.md`

  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        'User-Agent': 'read-frog-website',
      },
    })
    if (!response.ok)
      return ''
    return await response.text()
  }
  catch {
    return ''
  }
}

export default async function ChangelogPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const searchParams = await props.searchParams
  const t = await getTranslations('changelog')
  const activeTab = (searchParams.tab || 'extension') as 'extension' | 'website'

  const extensionChangelog = await getChangelogContent('extension')
  const websiteChangelog = await getChangelogContent('website')

  const svg = `<svg viewBox='0 0 500 500' xmlns='http://www.w3.org/2000/svg'>
  <filter id='noiseFilter'>
    <feTurbulence 
      type='fractalNoise' 
      baseFrequency='0.65' 
      numOctaves='3' 
      stitchTiles='stitch'/>
  </filter>
  
  <rect width='100%' height='100%' filter='url(#noiseFilter)'/>
</svg>`

  return (
    <main className="mx-auto w-full max-w-fd-container sm:px-4 md:py-12">
      <div
        className="h-[300px] p-8 md:h-[400px] md:p-12"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 70% 10%, rgba(34, 193, 195, 0.5), transparent)',
            'radial-gradient(circle at 0% 80%, rgba(139, 92, 246, 0.5), transparent)',
            'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.3), transparent)',
            `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
          ].join(', '),
        }}
      >
        <h1 className="mb-4 border-b-4 border-fd-foreground pb-2 text-4xl font-bold md:text-5xl">
          {t('title')}
        </h1>
        <p className="text-sm md:text-base">
          {t('description')}
        </p>
      </div>

      <ChangelogContent
        activeTab={activeTab}
        extensionChangelog={extensionChangelog}
        websiteChangelog={websiteChangelog}
      />
    </main>
  )
}
