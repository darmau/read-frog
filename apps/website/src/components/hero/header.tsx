'use client'

import { IconLanguage, IconMoustache } from '@tabler/icons-react'
import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import React from 'react'
import { Install } from '@/components/install'

export function Header() {
  const t = useTranslations('home')

  return (
    <div className="relative flex h-160 md:h-200 flex-col items-center justify-center bg-zinc-50 text-slate-950 dark:bg-zinc-900">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: 'easeInOut',
        }}
        viewport={{ once: true }}
        className="w-full md:max-w-6xl flex flex-col gap-4 items-center justify-center px-8 md:px-4 pt-20"
      >
        <h2 className="w-full text-balance whitespace-pre-wrap text-4xl md:text-7xl font-bold dark:text-white text-center tracking-normal leading-11 md:leading-20">
          {t('yourLanguage')}
          {' '}
          <span className="inline-block align-middle">
            <IconLanguage className="w-12 h-12 md:w-20 md:h-20 text-blue-500 inline-block align-middle" stroke={1.5} />
            {t('translator')}
          </span>
          {' '}
          <span className="inline-block align-middle">
            <IconMoustache className="w-12 h-12 md:w-20 md:h-20 text-amber-500 inline-block align-middle" stroke={1.5} />
            {t('teacher')}
          </span>
        </h2>
        <div className="max-w-4xl text-base text-neutral-600 dark:text-neutral-200 py-4 text-center">
          {t('subtitle')}
        </div>
        <div className="mt-6">
          <div className="text-center mb-4 font-light text-sm text-neutral-500 dark:text-neutral-400">
            {t('install.on')}
          </div>
          <Install />
        </div>
      </motion.div>
    </div>
  )
}
