import { createRef, type ComponentProps } from 'react'

import { Button } from '../src/components.tsx'

const buttonProps: ComponentProps<typeof Button> = {
  children: 'Save',
  onClick: function(event) {
    event.currentTarget.disabled = true
  },
}
const buttonRef = createRef<HTMLButtonElement>()
const button = <Button {...buttonProps} ref={buttonRef} />

const anchorProps: ComponentProps<typeof Button> = {
  children: 'Spaces',
  href: '/spaces',
  target: '_blank',
}
const anchorRef = createRef<HTMLAnchorElement>()
const anchor = <Button {...anchorProps} ref={anchorRef} />

const maybeHref: string | undefined = Math.random() > 0.5 ? '/feed' : undefined
const compatibleButton = <Button href={maybeHref}>Feed</Button>

// @ts-expect-error An href renders an anchor, so a button ref is unsafe.
const anchorWithButtonRef = <Button href="/spaces" ref={buttonRef}>Spaces</Button>
// @ts-expect-error A button cannot populate an anchor ref.
const buttonWithAnchorRef = <Button ref={anchorRef}>Save</Button>

void button
void anchor
void compatibleButton
void anchorWithButtonRef
void buttonWithAnchorRef
