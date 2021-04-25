import { css } from '@emotion/css';
import { GrafanaThemeV2 } from '@grafana/data';
import { Button, Field, Input, LinkButton, useStyles2 } from '@grafana/ui';
import { NotifierDTO } from 'app/types';
import React, { useCallback } from 'react';
import { useForm, FormContext, NestDataObject, FieldError, Validate } from 'react-hook-form';
import { useControlledFieldArray } from '../../../hooks/useControlledFieldArray';
import { ChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { makeAMLink } from '../../../utils/misc';
import { ChannelSubForm } from './ChannelSubForm';

interface Props<R extends ChannelValues> {
  notifiers: NotifierDTO[];
  defaultItem: R;
  alertManagerSourceName: string;
  onSubmit: (values: ReceiverFormValues<R>) => void;
  takenReceiverNames: string[]; // will validate that user entered receiver name is not one of these
  initialValues?: ReceiverFormValues<R>;
}

export function ReceiverForm<R extends ChannelValues>({
  initialValues,
  defaultItem,
  notifiers,
  alertManagerSourceName,
  onSubmit,
  takenReceiverNames,
}: Props<ChannelValues>): JSX.Element {
  const styles = useStyles2(getStyles);

  const defaultValues = initialValues || {
    name: '',
    items: [
      {
        ...defaultItem,
        __id: String(Math.random()),
      } as any,
    ],
  };

  const formAPI = useForm<ReceiverFormValues<R>>({
    defaultValues,
  });

  const { handleSubmit, register, errors, getValues } = formAPI;

  const { items, append, remove } = useControlledFieldArray<R>('items', formAPI);

  const validateNameIsAvailable: Validate = useCallback(
    (name: string) =>
      takenReceiverNames.map((name) => name.trim().toLowerCase()).includes(name.trim().toLowerCase())
        ? 'Another receiver with this name already exists.'
        : true,
    [takenReceiverNames]
  );

  return (
    <FormContext {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <h4 className={styles.heading}>{initialValues ? 'Update contact point' : 'Create contact point'}</h4>
        <Field label="Name" invalid={!!errors.name} error={errors.name && errors.name.message}>
          <Input
            width={39}
            name="name"
            ref={register({ required: 'Name is required', validate: { nameIsAvailable: validateNameIsAvailable } })}
          />
        </Field>
        {items.map((item, index) => {
          const initialItem = initialValues?.items.find(({ __id }) => __id === item.__id);
          return (
            <ChannelSubForm<R>
              key={item.__id}
              onDuplicate={() => {
                const currentValues = getValues({ nest: true }).items[index];
                append({ ...currentValues, __id: String(Math.random()) });
              }}
              onDelete={() => remove(index)}
              pathPrefix={`items.${index}.`}
              notifiers={notifiers}
              secureFields={initialItem?.secureFields}
              errors={errors?.items?.[index] as NestDataObject<R, FieldError>}
            />
          );
        })}
        <Button type="button" icon="plus" onClick={() => append({ ...defaultItem, __id: String(Math.random()) } as R)}>
          New contact point type
        </Button>
        <div className={styles.buttons}>
          <Button type="submit">Save contact point</Button>
          <LinkButton variant="secondary" href={makeAMLink('/alerting/notifications', alertManagerSourceName)}>
            Cancel
          </LinkButton>
        </div>
      </form>
    </FormContext>
  );
}

const getStyles = (theme: GrafanaThemeV2) => ({
  heading: css`
    margin: ${theme.spacing(4, 0)};
  `,
  buttons: css`
    margin-top: ${theme.spacing(4)};

    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
  `,
});
