// @vitest-environment jsdom
import type { Config } from '@/types/config/config'
import { describe, expect, it } from 'vitest'

import {
  BLOCK_CONTENT_CLASS,
  INLINE_CONTENT_CLASS,
} from '@/utils/constants/dom-labels'

import { isDontWalkIntoAndDontTranslateAsChildElement, isTranslatedContentNode } from '../filter'

describe('isTranslatedContentNode', () => {
  it('should return true for block translated content', () => {
    const element = document.createElement('span')
    element.className = BLOCK_CONTENT_CLASS
    expect(isTranslatedContentNode(element)).toBe(true)
  })

  it('should return true for inline translated content', () => {
    const element = document.createElement('span')
    element.className = INLINE_CONTENT_CLASS
    expect(isTranslatedContentNode(element)).toBe(true)
  })

  it('should return false for non-translated content', () => {
    const element = document.createElement('div')
    element.className = 'some-other-class'
    expect(isTranslatedContentNode(element)).toBe(false)
  })

  it('should return false for text nodes', () => {
    const textNode = document.createTextNode('text')
    expect(isTranslatedContentNode(textNode)).toBe(false)
  })

  it('should return true for elements with both classes', () => {
    const element = document.createElement('span')
    element.className = `${BLOCK_CONTENT_CLASS} ${INLINE_CONTENT_CLASS}`
    expect(isTranslatedContentNode(element)).toBe(true)
  })
})

describe('isDontWalkIntoAndDontTranslateAsChildElement - Main Content Mode', () => {
  const createMockConfig = (range: 'main' | 'all'): Config => ({
    translate: {
      page: {
        range,
      },
    },
  } as Config)

  it('should exclude UI elements in main content mode', () => {
    const config = createMockConfig('main')
    const uiTags = ['HEADER', 'FOOTER', 'NAV', 'ASIDE', 'DIALOG', 'MENU', 'BUTTON', 'FORM', 'LABEL']

    uiTags.forEach((tag) => {
      const element = document.createElement(tag)
      const result = isDontWalkIntoAndDontTranslateAsChildElement(element, config)
      expect(result).toBe(true)
    })
  })

  it('should not exclude article elements in main content mode', () => {
    const config = createMockConfig('main')
    const articleTags = ['ARTICLE', 'SECTION', 'P', 'DIV', 'SPAN', 'H1', 'H2']

    articleTags.forEach((tag) => {
      const element = document.createElement(tag)
      const result = isDontWalkIntoAndDontTranslateAsChildElement(element, config)
      expect(result).toBe(false)
    })
  })

  it('should not exclude UI elements in all-page mode', () => {
    const config = createMockConfig('all')
    const uiTags = ['HEADER', 'FOOTER', 'NAV', 'ASIDE', 'BUTTON', 'FORM', 'LABEL']

    uiTags.forEach((tag) => {
      const element = document.createElement(tag)
      const result = isDontWalkIntoAndDontTranslateAsChildElement(element, config)
      expect(result).toBe(false)
    })
  })

  it('should always exclude invalid tags regardless of mode', () => {
    const configMain = createMockConfig('main')
    const configAll = createMockConfig('all')
    const invalidTags = ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA']

    invalidTags.forEach((tag) => {
      const element = document.createElement(tag)
      expect(isDontWalkIntoAndDontTranslateAsChildElement(element, configMain)).toBe(true)
      expect(isDontWalkIntoAndDontTranslateAsChildElement(element, configAll)).toBe(true)
    })
  })
})
