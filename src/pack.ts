import data from './data/pack.json'

export type QA = { q: string; a: string; image?: string }

export type KnowCategory = {
  id: string
  title: string
  questions: QA[]
}

export type GuessItem = {
  id: string
  points: number
  answer: string
  image?: string
  emoji?: string
}

export type GuessCategory = {
  id: string
  title: string
  items: GuessItem[]
}

export type BrainTask = {
  id: string
  group: string
  seconds: number
  prompt: string
  answer: string
  note?: string
  image?: string
}

export type BuzzerCategory = {
  id: string
  title: string
  questions: QA[]
}

export type FinalTask = {
  prompt: string
  letters: string
  answer: string
  take: string
}

export type FinalSet = {
  id: string
  title: string
  word: string
  tasks: FinalTask[]
}

export type Pack = {
  know: KnowCategory[]
  guess: GuessCategory[]
  brain: BrainTask[]
  buzzer: BuzzerCategory[]
  final: FinalSet[]
}

export const pack = data as Pack
