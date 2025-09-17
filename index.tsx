import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react'
import {
  SectionBase,
  SectionListData,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import { FlashList, ListRenderItem } from '@shopify/flash-list'

interface SeparatorProps<ItemT, SectionT> {
  index: number
  leadingItem: DataItem<ItemT, SectionT>
  trailingItem: DataItem<ItemT, SectionT>
}

export interface SectionIndexData {
  char: string
  actualIndex: number
}

type DataItem<ItemT, SectionT> =
  | { type: 'sectionHeader'; section: SectionT }
  | { type: 'row'; item: ItemT }

interface FlashSectionListProps<
  ItemT,
  SectionT extends SectionBase<ItemT, SectionT>,
> extends Omit<
    React.ComponentProps<typeof FlashList<DataItem<ItemT, SectionT>>>,
    'data' | 'renderItem' | 'keyExtractor'
  > {
  sections: SectionT[]
  renderItem: ListRenderItem<ItemT>
  keyExtractor?: (item: DataItem<ItemT, SectionT>, index: number) => string
  renderSectionFooter?: (info: {
    section: SectionListData<ItemT, SectionT>
  }) => React.ReactElement | null
  renderSectionHeader?: (info: {
    section: SectionListData<ItemT, SectionT>
  }) => React.ReactElement | null
  SectionSeparatorComponent?: (
    props: SeparatorProps<ItemT, SectionT>,
  ) => React.ReactElement | null
  ItemSeparatorComponent?: (
    props: SeparatorProps<ItemT, SectionT>,
  ) => React.ReactElement | null
  stickySectionHeadersEnabled?: boolean
  sectionIndexOptions?: {
    sectionIndexLabelsKey: keyof SectionT
    onSectionIndexPress?: (index: number) => void
    dark?: boolean
    barContainerStyle?: ViewStyle
    barStyle?: ViewStyle
    textStyle?: TextStyle
  }
}

export const FlashSectionList = forwardRef(function FlashSectionList<
  ItemT,
  SectionT extends SectionBase<ItemT, SectionT>,
>(
  props: FlashSectionListProps<ItemT, SectionT>,
  ref: React.Ref<FlashList<DataItem<ItemT, SectionT>>>,
) {
  const innerRef = useRef<FlashList<DataItem<ItemT, SectionT>>>(null)

  // Flatten sections -> data
  const data = props.sections.flatMap((section) => [
    { type: 'sectionHeader', section },
    ...section.data.map((item) => ({ type: 'row', item })),
  ]) as DataItem<ItemT, SectionT>[]

  // Sticky headers + Section index
  const stickyHeaderIndices: number[] = []
  const sectionLabels: SectionIndexData[] = []
  data.forEach((item, index) => {
    if (item.type === 'sectionHeader') {
      sectionLabels.push({
        char: String(
          (item.section as any)[props.sectionIndexOptions?.sectionIndexLabelsKey],
        ),
        actualIndex: index,
      })
      if (props.stickySectionHeadersEnabled !== false) {
        stickyHeaderIndices.push(index)
      }
    }
  })

  // expose scrollToSection
  useImperativeHandle(ref, () => ({
    ...innerRef.current,
    scrollToSection: (sectionIndex: number, animated = true) => {
      const label = sectionLabels[sectionIndex]
      if (label) {
        innerRef.current?.scrollToIndex({
          index: label.actualIndex,
          animated,
        })
      }
    },
  }))

  // Separator render helper
  const renderSeparator = (
    index: number,
    isSection: boolean,
  ): React.ReactElement | null => {
    if (index + 1 >= data.length) return null
    const leadingItem = data[index]
    const trailingItem = data[index + 1]
    const Separator = isSection
      ? props.SectionSeparatorComponent
      : props.ItemSeparatorComponent
    return Separator ? (
      <Separator
        index={index}
        leadingItem={leadingItem}
        trailingItem={trailingItem}
      />
    ) : null
  }

  // renderItem
  const renderItem: ListRenderItem<DataItem<ItemT, SectionT>> = (info) => {
    if (info.item.type === 'sectionHeader') {
      return (
        <>
          {props.inverted ? renderSeparator(info.index, true) : null}
          <View style={{ flexDirection: props.horizontal ? 'column' : 'row' }}>
            {props.renderSectionHeader?.({
              section: info.item.section as any,
            }) || null}
          </View>
          {!props.inverted ? renderSeparator(info.index, true) : null}
        </>
      )
    }
    return (
      <>
        {props.inverted ? renderSeparator(info.index, false) : null}
        <View
          style={{
            flexDirection:
              props.horizontal || props.numColumns === 1 ? 'column' : 'row',
          }}
        >
          {props.renderItem?.({ item: info.item.item } as any)}
        </View>
        {!props.inverted ? renderSeparator(info.index, false) : null}
      </>
    )
  }

  // overrideItemLayout
  const overrideItemLayout = (
    layout: { span?: number; size?: number },
    item: DataItem<ItemT, SectionT>,
    index: number,
    maxColumns: number,
  ) => {
    props.overrideItemLayout?.(layout, item, index, maxColumns)
    layout.span = item.type === 'sectionHeader' ? maxColumns : 1
  }

  // viewability
  const viewabilityConfig = { itemVisiblePercentThreshold: 50 }
  const onViewableItemsChanged = useCallback<
    NonNullable<React.ComponentProps<typeof FlashList>['onViewableItemsChanged']>
  >(
    ({ viewableItems }) => {
      const firstVisibleSection = viewableItems.find(
        (vi) => vi.item?.type === 'sectionHeader',
      )
      if (firstVisibleSection) {
        const sectionIndex = sectionLabels.findIndex(
          (s) => s.actualIndex === firstVisibleSection.index,
        )
        if (sectionIndex >= 0) {
          props.sectionIndexOptions?.onSectionIndexPress?.(sectionIndex)
        }
      }
    },
    [sectionLabels, props.sectionIndexOptions],
  )

  return (
    <FlashList
      {...props}
      ref={innerRef}
      data={data}
      renderItem={renderItem}
      getItemType={(item) => item.type}
      overrideItemLayout={overrideItemLayout}
      contentContainerStyle={props.contentContainerStyle}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
    />
  )
})
